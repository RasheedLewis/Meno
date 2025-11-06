import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

import { listChatMessages, persistChatMessage } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types/chat";

type ChatConnection = WebSocket & {
  meta?: {
    sessionId: string;
    participantId: string;
    name: string;
    role: ChatMessage["role"];
  };
};

type ConnectionMap = Map<string, Set<ChatConnection>>;

interface ChatServer {
  wss: WebSocketServer;
  connections: ConnectionMap;
}

interface SendEvent {
  type: "chat.send";
  id?: string;
  content: string;
  role?: ChatMessage["role"];
  meta?: ChatMessage["meta"];
}

interface AckEvent {
  type: "chat.ack";
  id: string;
}

interface SyncEvent {
  type: "chat.sync";
  sessionId: string;
  messages: ChatMessage[];
}

interface MessageEvent {
  type: "chat.message";
  sessionId: string;
  message: ChatMessage;
}

type ClientEvent = SendEvent;

const createServer = (server: HTTPServer): ChatServer => {
  const wss = new WebSocketServer({ noServer: true });
  const connections: ConnectionMap = new Map();

  const register = (sessionId: string, socket: ChatConnection) => {
    if (!connections.has(sessionId)) {
      connections.set(sessionId, new Set());
    }
    connections.get(sessionId)?.add(socket);
  };

  const unregister = (sessionId: string, socket: ChatConnection) => {
    connections.get(sessionId)?.delete(socket);
    if ((connections.get(sessionId)?.size ?? 0) === 0) {
      connections.delete(sessionId);
    }
  };

  const broadcast = (sessionId: string, payload: MessageEvent | SyncEvent | AckEvent) => {
    const message = JSON.stringify(payload);
    connections.get(sessionId)?.forEach((connection) => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(message);
      }
    });
  };

  wss.on("connection", async (socket: ChatConnection, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const participantId = url.searchParams.get("participantId") ?? "";
    const name = url.searchParams.get("name") ?? "";
    const role = (url.searchParams.get("role") as ChatMessage["role"]) ?? "student";

    if (!sessionId || !participantId) {
      socket.close(4001, "missing session information");
      return;
    }

    socket.meta = { sessionId, participantId, name, role };
    register(sessionId, socket);

    try {
      const history = await listChatMessages(sessionId, 200);
      socket.send(
        JSON.stringify({
          type: "chat.sync",
          sessionId,
          messages: history,
        } satisfies SyncEvent),
      );
    } catch (error) {
      console.error("Chat history load failed", error);
    }

    socket.on("message", async (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as ClientEvent;
        if (event.type !== "chat.send" || !socket.meta) {
          return;
        }

        const messageId = event.id ?? (globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}`);
        const createdAt = new Date().toISOString();
        const message: ChatMessage = {
          id: messageId,
          role: event.role ?? socket.meta.role ?? "student",
          content: event.content,
          createdAt,
          meta: {
            ...event.meta,
            sessionId: socket.meta.sessionId,
            participantId: socket.meta.participantId,
            source: event.meta?.source ?? "chat",
            channel: event.meta?.channel ?? "public",
            payload: {
              ...event.meta?.payload,
              senderName: socket.meta.name,
            },
          },
        };

        try {
          await persistChatMessage({ sessionId: socket.meta.sessionId, message });
        } catch (persistenceError) {
          console.error("Chat persistence failed", persistenceError);
        }

        broadcast(socket.meta.sessionId, {
          type: "chat.message",
          sessionId: socket.meta.sessionId,
          message,
        });
      } catch (error) {
        console.error("Chat message handling failed", error);
      }
    });

    socket.once("close", () => {
      if (socket.meta) {
        unregister(socket.meta.sessionId, socket);
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/api/chat")) {
      return;
    }

    wss.handleUpgrade(request, socket as never, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  return { wss, connections };
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

  const serverSocket = res.socket as NextApiResponse["socket"] & { server: HTTPServer };
  const server = serverSocket.server as HTTPServer & {
    __menoChat?: ChatServer;
  };

  if (!server.__menoChat) {
    server.__menoChat = createServer(server);
  }

  if (req.headers.upgrade?.toLowerCase() === "websocket") {
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: "Method not allowed" });
}
