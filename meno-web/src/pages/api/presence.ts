import type { NextApiRequest } from "next";
import type { NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

import { listPresence, markDisconnected, updatePresenceState, upsertPresence } from "@/lib/presence/store";
import type { PresenceBroadcast, PresenceClientEvent, PresenceRecord } from "@/lib/presence/types";

type PresenceConnection = WebSocket & {
  meta?: {
    sessionId: string;
    participantId: string;
  };
};

type ConnectionsMap = Map<string, Set<PresenceConnection>>;

const HEARTBEAT_INTERVAL = 30_000;

const createPresenceServer = (server: HTTPServer) => {
  const wss = new WebSocketServer({ noServer: true });
  const connections: ConnectionsMap = new Map();

  const registerConnection = (sessionId: string, socket: PresenceConnection) => {
    if (!connections.has(sessionId)) {
      connections.set(sessionId, new Set());
    }
    connections.get(sessionId)?.add(socket);
  };

  const unregisterConnection = async (sessionId: string, socket: PresenceConnection) => {
    connections.get(sessionId)?.delete(socket);
    if (connections.get(sessionId)?.size === 0) {
      connections.delete(sessionId);
    }
    if (socket.meta) {
      await markDisconnected(socket.meta.sessionId, socket.meta.participantId);
    }
    await broadcastPresence(sessionId);
  };

  const broadcastPresence = async (sessionId: string) => {
    const participants = await listPresence(sessionId);
    const typingIds = participants.filter((participant) => participant.isTyping).map((participant) => participant.participantId);
    let typingSummary: PresenceBroadcast["typingSummary"] = "none";
    if (typingIds.length === 1) {
      typingSummary = "single";
    } else if (typingIds.length > 1) {
      typingSummary = "multiple";
    }

    const payload: PresenceBroadcast = {
      type: "presence.sync",
      sessionId,
      participants,
      typingSummary,
      typingIds,
    };

    const data = JSON.stringify(payload);
    connections.get(sessionId)?.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  wss.on("connection", (socket: PresenceConnection, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const participantId = url.searchParams.get("participantId") ?? "";
    const name = url.searchParams.get("name") ?? "";
    const role = (url.searchParams.get("role") as PresenceRecord["role"]) ?? "student";

    if (!sessionId || !participantId || !name) {
      socket.close(4001, "missing session or participant info");
      return;
    }

    socket.meta = { sessionId, participantId };

    registerConnection(sessionId, socket);

    upsertPresence({ sessionId, participantId, name, role })
      .then(() => broadcastPresence(sessionId))
      .catch((error) => console.error("Presence upsert failed", error));

    const heartbeat = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeat);
        return;
      }
      socket.send(JSON.stringify({ type: "ping" }));
    }, HEARTBEAT_INTERVAL);

    socket.on("message", async (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as PresenceClientEvent;
        await handleClientEvent(socket, event);
        if (socket.meta) {
          await broadcastPresence(socket.meta.sessionId);
        }
      } catch (error) {
        console.error("Presence message failed", error);
      }
    });

    socket.once("close", async () => {
      clearInterval(heartbeat);
      if (socket.meta) {
        await unregisterConnection(socket.meta.sessionId, socket);
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/api/presence")) {
      return;
    }

    wss.handleUpgrade(request, socket as never, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  const handleClientEvent = async (socket: PresenceConnection, event: PresenceClientEvent) => {
    if (!socket.meta) return;
    const { sessionId, participantId } = socket.meta;

    switch (event.type) {
      case "join": {
        await updatePresenceState(sessionId, participantId, {
          status: "online",
          isTyping: false,
          isSpeaking: false,
          name: event.name,
          role: event.role,
        });
        break;
      }
      case "typing": {
        await updatePresenceState(sessionId, participantId, {
          status: event.isTyping ? "typing" : "online",
          isTyping: event.isTyping,
        });
        break;
      }
      case "speaking": {
        await updatePresenceState(sessionId, participantId, {
          status: event.isSpeaking ? "speaking" : "online",
          isSpeaking: event.isSpeaking,
        });
        break;
      }
      case "heartbeat": {
        await updatePresenceState(sessionId, participantId, {});
        break;
      }
      default:
        break;
    }
  };

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
    __menoPresence?: {
      wss: WebSocketServer;
      connections: ConnectionsMap;
    };
  };

  if (!server.__menoPresence) {
    server.__menoPresence = createPresenceServer(server);
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
