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

        if (!CLIENT_MESSAGE_TYPES.has(messageType)) {
            return false;
        }

        console.debug("[YWS] custom realtime message", {
            sessionId,
            messageType,
            connection: ws.url,
        });

        // TODO: route chat/presence/control payloads
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


