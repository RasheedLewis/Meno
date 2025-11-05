import type { ParticipantRole } from "@/lib/store/session";
import { usePresenceStore } from "@/lib/store/presence";

import type { PresenceBroadcast, PresenceClientEvent } from "./types";

interface ConnectConfig {
  sessionId: string;
  participantId: string;
  name: string;
  role: ParticipantRole;
}

const HEARTBEAT_MS = 20_000;

let socket: WebSocket | null = null;
let heartbeatId: ReturnType<typeof setInterval> | null = null;
let lastTypingState = false;

const buildUrl = (config: ConnectConfig) => {
  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/presence", origin);
  url.protocol = url.protocol.replace("http", "ws");
  url.searchParams.set("sessionId", config.sessionId);
  url.searchParams.set("participantId", config.participantId);
  url.searchParams.set("name", config.name);
  url.searchParams.set("role", config.role);
  return url.toString();
};

const send = (payload: PresenceClientEvent) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
};

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatId = setInterval(() => {
    send({ type: "heartbeat" });
  }, HEARTBEAT_MS);
};

const stopHeartbeat = () => {
  if (heartbeatId) {
    clearInterval(heartbeatId);
    heartbeatId = null;
  }
};

const handleBroadcast = (event: PresenceBroadcast) => {
  usePresenceStore.getState().setParticipants(event.participants, event.typingSummary, event.typingIds);
};

export const presenceClient = {
  connect: (config: ConnectConfig) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }

    usePresenceStore.getState().setConnectionState("connecting");

    socket = new WebSocket(buildUrl(config));

    socket.addEventListener("open", () => {
      usePresenceStore.getState().setConnectionState("open");
      send({
        type: "join",
        sessionId: config.sessionId,
        participantId: config.participantId,
        name: config.name,
        role: config.role,
      });
      startHeartbeat();
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data) as PresenceBroadcast | { type: string };
        if (parsed.type === "presence.sync") {
          handleBroadcast(parsed as PresenceBroadcast);
        }
      } catch (error) {
        console.error("Failed to parse presence message", error);
      }
    });

    socket.addEventListener("close", () => {
      usePresenceStore.getState().setConnectionState("closed");
      usePresenceStore.getState().reset();
      stopHeartbeat();
      socket = null;
    });

    socket.addEventListener("error", () => {
      usePresenceStore.getState().setConnectionState("error");
    });
  },

  disconnect: () => {
    if (!socket) return;
    socket.close();
    socket = null;
    stopHeartbeat();
    usePresenceStore.getState().reset();
    lastTypingState = false;
  },

  setTyping: (isTyping: boolean) => {
    if (isTyping === lastTypingState) {
      return;
    }
    lastTypingState = isTyping;
    send({ type: "typing", isTyping });
  },

  setSpeaking: (isSpeaking: boolean) => {
    send({ type: "speaking", isSpeaking });
  },
};
