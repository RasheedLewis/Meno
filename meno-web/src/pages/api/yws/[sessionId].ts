import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { setupWSConnection } from "y-websocket/bin/utils";

import {
    REALTIME_MESSAGE_TYPE,
    type RealtimeMessageType,
    type RealtimeChatAppendPayload,
    type RealtimePresenceEventPayload,
    type RealtimePresenceParticipant,
} from "@/lib/realtime/messages";
import { persistChatMessage, listChatMessages } from "@/lib/chat/store";
import {
    upsertPresence,
    updatePresenceState,
    listPresence,
    getPresence,
} from "@/lib/presence/store";
import type { PresenceRecord } from "@/lib/presence/types";
import type { ChatMessage } from "@/lib/types/chat";

type SessionConnections = Map<string, Set<WebSocket>>;

type YjsServerState = {
    wss: WebSocketServer;
    connections: SessionConnections;
};

type ExtendedServer = HTTPServer & {
    __menoYjs?: YjsServerState;
};

type ExtendedSocket = NextApiResponse["socket"] & {
    server: ExtendedServer;
};

const YWS_PATH = "/api/yws";

const CLIENT_MESSAGE_TYPES = new Set<RealtimeMessageType>([
    REALTIME_MESSAGE_TYPE.CHAT_APPEND,
    REALTIME_MESSAGE_TYPE.PRESENCE_EVENT,
    REALTIME_MESSAGE_TYPE.CONTROL_LEASE_REQUEST,
]);

const sendRealtimeServerMessage = async (
    ws: WebSocket,
    type: RealtimeMessageType,
    payload: unknown,
) => {
    if (ws.readyState !== ws.OPEN) {
        return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, type);
    encoding.writeVarString(encoder, JSON.stringify(payload));

    ws.send(encoding.toUint8Array(encoder));
};

const asUint8Array = (data: RawData): Uint8Array | null => {
    if (data instanceof Uint8Array) {
        return data;
    }
    if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    if (Array.isArray(data)) {
        const totalLength = data.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        data.forEach((chunk) => {
            merged.set(chunk, offset);
            offset += chunk.length;
        });
        return merged;
    }
    if (Buffer.isBuffer(data)) {
        return new Uint8Array(data);
    }
    return null;
};

const mapPresenceRecord = (record: PresenceRecord): RealtimePresenceParticipant => ({
    participantId: record.participantId,
    name: record.name,
    role: record.role,
    color: record.color,
    status: record.status,
    isTyping: record.isTyping,
    isSpeaking: record.isSpeaking,
    lastSeen: record.lastSeen,
    muted: record.muted,
    addressed: record.addressed,
    caption: record.caption,
    expiresAt: record.expiresAt,
});

const broadcastRealtimeMessage = (
    sessionId: string,
    state: YjsServerState,
    type: RealtimeMessageType,
    payload: unknown,
) => {
    const targets = state.connections.get(sessionId);
    if (!targets || targets.size === 0) {
        return;
    }
    targets.forEach((connection) => {
        void sendRealtimeServerMessage(connection, type, payload).catch((error) => {
            console.error("[YWS] broadcast failed", { sessionId, type, error });
        });
    });
};

const registerConnection = (sessionId: string, ws: WebSocket, state: YjsServerState) => {
    const current = state.connections.get(sessionId) ?? new Set<WebSocket>();
    current.add(ws);
    state.connections.set(sessionId, current);
};

const unregisterConnection = (sessionId: string, ws: WebSocket, state: YjsServerState) => {
    const current = state.connections.get(sessionId);
    if (!current) {
        return;
    }
    current.delete(ws);
    if (current.size === 0) {
        state.connections.delete(sessionId);
    }
};

const handleRealtimeClientMessage = (
    sessionId: string,
    ws: WebSocket,
    data: RawData,
    state: YjsServerState,
): boolean => {
    const payload = asUint8Array(data);
    if (!payload) {
        return false;
    }

    try {
        const decoder = decoding.createDecoder(payload);
        const messageType = decoding.readVarUint(decoder) as RealtimeMessageType;
        const payloadJson = decoding.hasContent(decoder) ? decoding.readVarString(decoder) : "";
        const parsedPayload = payloadJson ? JSON.parse(payloadJson) : null;

        if (!CLIENT_MESSAGE_TYPES.has(messageType)) {
            return false;
        }

        if (messageType === REALTIME_MESSAGE_TYPE.CHAT_APPEND && parsedPayload) {
            const { message } = parsedPayload as RealtimeChatAppendPayload;
            const enriched: ChatMessage = {
                ...message,
                createdAt: message.createdAt ?? new Date().toISOString(),
                meta: {
                    ...message.meta,
                    sessionId,
                    participantId: message.meta?.participantId,
                },
            };

            void persistChatMessage({ sessionId, message: enriched }).catch((error) => {
                console.error("[YWS] chat persistence failed", { sessionId, error });
            });

            broadcastRealtimeMessage(sessionId, state, REALTIME_MESSAGE_TYPE.CHAT_APPEND, {
                sessionId,
                message: enriched,
            });

            return true;
        }

        if (messageType === REALTIME_MESSAGE_TYPE.PRESENCE_EVENT && parsedPayload) {
            const { participantId, event } = parsedPayload as RealtimePresenceEventPayload;

            if (!participantId) {
                console.warn("[YWS] presence event missing participantId", { sessionId, event });
                return true;
            }

            if (event.type === "join") {
                void (async () => {
                    try {
                        const record = await upsertPresence({
                            sessionId,
                            participantId,
                            name: event.name,
                            role: event.role,
                        });
                        broadcastRealtimeMessage(sessionId, state, REALTIME_MESSAGE_TYPE.PRESENCE_EVENT, {
                            sessionId,
                            participantId,
                            event,
                            record: mapPresenceRecord(record),
                        });
                    } catch (error) {
                        console.error("[YWS] presence join failed", { sessionId, error });
                    }
                })();
                return true;
            }

            if (event.type === "typing") {
                void (async () => {
                    try {
                        await updatePresenceState(sessionId, participantId, {
                            isTyping: event.isTyping,
                        });
                        const record = await getPresence(sessionId, participantId);
                        broadcastRealtimeMessage(sessionId, state, REALTIME_MESSAGE_TYPE.PRESENCE_EVENT, {
                            sessionId,
                            participantId,
                            event,
                            record: record ? mapPresenceRecord(record) : undefined,
                        });
                    } catch (error) {
                        console.error("[YWS] presence typing update failed", { sessionId, error });
                    }
                })();
                return true;
            }

            if (event.type === "speaking") {
                void (async () => {
                    try {
                        await updatePresenceState(sessionId, participantId, {
                            isSpeaking: event.isSpeaking,
                        });
                        const record = await getPresence(sessionId, participantId);
                        broadcastRealtimeMessage(sessionId, state, REALTIME_MESSAGE_TYPE.PRESENCE_EVENT, {
                            sessionId,
                            participantId,
                            event,
                            record: record ? mapPresenceRecord(record) : undefined,
                        });
                    } catch (error) {
                        console.error("[YWS] presence speaking update failed", { sessionId, error });
                    }
                })();
                return true;
            }

            if (event.type === "heartbeat") {
                void updatePresenceState(sessionId, participantId, {
                    status: "online",
                }).catch((error) => {
                    console.error("[YWS] presence heartbeat failed", { sessionId, error });
                });
                return true;
            }

            return true;
        }

        return true;
    } catch (error) {
        console.error("[YWS] failed to decode realtime message", { sessionId, error });
        return true;
    }
};

const computeTypingSummary = (participants: RealtimePresenceParticipant[]) => {
    const typingIds = participants.filter((record) => record.isTyping).map((record) => record.participantId);
    const typingSummary = typingIds.length === 0 ? "none" : typingIds.length === 1 ? "single" : "multiple";
    return { typingSummary, typingIds };
};

const hydrateConnection = async (sessionId: string, ws: WebSocket) => {
    try {
        const [messages, presence] = await Promise.all([
            listChatMessages(sessionId, 200),
            listPresence(sessionId),
        ]);

        await sendRealtimeServerMessage(ws, REALTIME_MESSAGE_TYPE.CHAT_SYNC, {
            sessionId,
            messages,
        });

        const participants: RealtimePresenceParticipant[] = presence.map((record) =>
            mapPresenceRecord(record),
        );

        const { typingIds, typingSummary } = computeTypingSummary(participants);

        await sendRealtimeServerMessage(ws, REALTIME_MESSAGE_TYPE.PRESENCE_SNAPSHOT, {
            sessionId,
            participants,
            typingSummary,
            typingIds,
        });
    } catch (error) {
        console.error("[YWS] failed to hydrate connection", { sessionId, error });
    }
};

const initializeServer = (server: ExtendedServer) => {
    if (server.__menoYjs) {
        return server.__menoYjs;
    }

    const wss = new WebSocketServer({ noServer: true });
    const state: YjsServerState = {
        wss,
        connections: new Map(),
    };

    server.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith(`${YWS_PATH}/`)) {
            return;
        }

        const sessionId = url.pathname.slice(YWS_PATH.length + 1);
        if (!sessionId) {
            socket.destroy();
            return;
        }

        console.log("[YWS] upgrade", sessionId, request.headers["user-agent"]);

        wss.handleUpgrade(request, socket as never, head, (ws) => {
            (request as NextApiRequest).url = `/${sessionId}`;

            const originalEmit = ws.emit.bind(ws);
            ws.emit = function patchedEmit(event: string | symbol, ...args: unknown[]) {
                if (event === "message") {
                    const [messageData] = args as [RawData];
                    if (handleRealtimeClientMessage(sessionId, ws, messageData, state)) {
                        return false;
                    }
                }
                return originalEmit(event, ...args);
            };

            setupWSConnection(ws, request, { docName: sessionId, pingTimeout: 30_000 });
            registerConnection(sessionId, ws, state);
            void hydrateConnection(sessionId, ws);
            ws.on("open", () => {
                console.log("[YWS] connection open", sessionId);
            });
            ws.on("close", (code, reason) => {
                console.log("[YWS] connection close", sessionId, code, reason.toString());
                unregisterConnection(sessionId, ws, state);
            });
            ws.on("error", (error) => {
                console.error("[YWS] connection error", sessionId, error);
            });
        });
    });

    server.__menoYjs = state;
    return server.__menoYjs;
};

export const config = {
    api: {
        bodyParser: false,
        externalResolver: true,
    },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!res.socket) {
        res.status(500).json({ ok: false, error: "Socket unavailable" });
        return;
    }

    const socket = res.socket as ExtendedSocket;
    const server = socket.server;

    initializeServer(server);

    if (req.headers.upgrade?.toLowerCase() === "websocket") {
        return;
    }

    res.status(200).json({ ok: true });
}


