import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

const YWS_PATH = "/api/yws";

type ExtendedServer = HTTPServer & {
  __menoYjs?: WebSocketServer;
};

type ExtendedSocket = NextApiResponse["socket"] & {
  server: ExtendedServer;
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

    const docName = url.pathname.slice(`${YWS_PATH}/`.length);
    if (!docName) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket as never, head, (ws) => {
      setupWSConnection(ws as never, request, { docName });
    });
  });

  server.__menoYjs = wss;
  return wss;
};

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket) {
    res.status(500).json({ ok: false, error: "Socket not available" });
    return;
  }

  const socket = res.socket as ExtendedSocket;
  initializeServer(socket.server);

  if (req.method === "GET") {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: "Method not allowed" });
}

