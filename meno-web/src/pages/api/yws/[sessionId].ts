import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";
import * as decoding from "lib0/decoding";
import { setupWSConnection } from "y-websocket/bin/utils";

import {
    REALTIME_MESSAGE_TYPE,
    type RealtimeMessageType,
} from "@/lib/realtime/messages";
import { persistChatMessage } from "@/lib/chat/store";
import {
    upsertPresence,
    updatePresenceState,
} from "@/lib/presence/store";
import type { ChatMessage } from "@/lib/types/chat";
import type {
    RealtimeChatAppendPayload,
    RealtimePresenceEventPayload,
} from "@/lib/realtime/messages";

type ExtendedServer = HTTPServer & {
    __menoYjs?: {
        wss: WebSocketServer;
    };
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

const handleRealtimeClientMessage = (sessionId: string, ws: WebSocket, data: RawData): boolean => {
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

            return true;
        }

        if (messageType === REALTIME_MESSAGE_TYPE.PRESENCE_EVENT && parsedPayload) {
            const { participantId, event } = parsedPayload as RealtimePresenceEventPayload;

            if (!participantId) {
                console.warn("[YWS] presence event missing participantId", { sessionId, event });
                return true;
            }

            if (event.type === "join") {
                void upsertPresence({
                    sessionId,
                    participantId,
                    name: event.name,
                    role: event.role,
                }).catch((error) => {
                    console.error("[YWS] presence join failed", { sessionId, error });
                });
                return true;
            }

            if (event.type === "typing") {
                void updatePresenceState(sessionId, participantId, {
                    isTyping: event.isTyping,
                }).catch((error) => {
                    console.error("[YWS] presence typing update failed", { sessionId, error });
                });
                return true;
            }

            if (event.type === "speaking") {
                void updatePresenceState(sessionId, participantId, {
                    isSpeaking: event.isSpeaking,
                }).catch((error) => {
                    console.error("[YWS] presence speaking update failed", { sessionId, error });
                });
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

const initializeServer = (server: ExtendedServer) => {
    if (server.__menoYjs) {
        return server.__menoYjs;
    }

    const wss = new WebSocketServer({ noServer: true });

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
                    if (handleRealtimeClientMessage(sessionId, ws, messageData)) {
                        return false;
                    }
                }
                return originalEmit(event, ...args);
            };

            setupWSConnection(ws, request, { docName: sessionId, pingTimeout: 30_000 });
            ws.on("open", () => {
                console.log("[YWS] connection open", sessionId);
            });
            ws.on("close", (code, reason) => {
                console.log("[YWS] connection close", sessionId, code, reason.toString());
            });
            ws.on("error", (error) => {
                console.error("[YWS] connection error", sessionId, error);
            });
        });
    });

    server.__menoYjs = { wss };
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


