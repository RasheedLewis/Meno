import type { ParticipantRole } from "@/lib/store/session";
import { useChatStore } from "@/lib/store/chat";
import type { ChatMessage } from "@/lib/types/chat";

interface ConnectConfig {
  sessionId: string;
  participantId: string;
  name: string;
  role: ParticipantRole;
}

interface SendOptions {
  id: string;
  content: string;
  role: ChatMessage["role"];
  meta?: ChatMessage["meta"];
}

type ServerEvent =
  | {
      type: "chat.sync";
      sessionId: string;
      messages: ChatMessage[];
    }
  | {
      type: "chat.message";
      sessionId: string;
      message: ChatMessage;
    };

let socket: WebSocket | null = null;
const outbox: SendOptions[] = [];

const buildUrl = (config: ConnectConfig) => {
  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/chat", origin);
  url.protocol = url.protocol.replace("http", "ws");
  url.searchParams.set("sessionId", config.sessionId);
  url.searchParams.set("participantId", config.participantId);
  url.searchParams.set("name", config.name);
  url.searchParams.set("role", config.role);
  return url.toString();
};

const flushOutbox = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  while (outbox.length > 0) {
    const next = outbox.shift();
    if (!next) break;
    socket.send(
      JSON.stringify({
        type: "chat.send",
        id: next.id,
        content: next.content,
        role: next.role,
        meta: next.meta,
      }),
    );
  }
};

const send = (options: SendOptions) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    outbox.push(options);
    return;
  }
  socket.send(
    JSON.stringify({
      type: "chat.send",
      id: options.id,
      content: options.content,
      role: options.role,
      meta: options.meta,
    }),
  );
};

export const chatClient = {
  connect: (config: ConnectConfig) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }

    socket = new WebSocket(buildUrl(config));

    socket.addEventListener("open", () => {
      flushOutbox();
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as ServerEvent;
        if (payload.type === "chat.sync") {
          useChatStore.getState().setMessages(payload.messages);
        } else if (payload.type === "chat.message") {
          useChatStore.getState().addMessage(payload.message);
        }
      } catch (error) {
        console.error("Failed to parse chat event", error);
      }
    });

    socket.addEventListener("close", () => {
      socket = null;
    });

    socket.addEventListener("error", (error) => {
      console.error("Chat socket error", error);
    });
  },

  disconnect: () => {
    if (!socket) return;
    socket.close();
    socket = null;
    outbox.length = 0;
  },

  sendMessage: (options: SendOptions) => {
    send(options);
  },
};
