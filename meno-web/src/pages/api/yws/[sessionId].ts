import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

type ExtendedServer = HTTPServer & {
    __menoYjs?: {
        wss: WebSocketServer;
    };
};

type ExtendedSocket = NextApiResponse["socket"] & {
    server: ExtendedServer;
};

const YWS_PATH = "/api/yws";

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


