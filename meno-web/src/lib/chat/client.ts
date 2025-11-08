import type { ParticipantRole } from "@/lib/store/session";
import type { ActiveLineLease } from "@/lib/store/session";
import { useChatStore } from "@/lib/store/chat";
import { useSessionStore } from "@/lib/store/session";
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

interface ControlActiveLineSetOptions {
  stepIndex: number | null;
  leaseTo?: string | null;
  leaseDurationMs?: number;
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
  }
  | {
    type: "control.activeLine";
    sessionId: string;
    activeLine: ActiveLineLease | null;
  };

let socket: WebSocket | null = null;
const outbox: string[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastConfig: ConnectConfig | null = null;

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
    socket.send(next);
  }
};

const send = (options: SendOptions) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    outbox.push(
      JSON.stringify({
        type: "chat.send",
        id: options.id,
        content: options.content,
        role: options.role,
        meta: options.meta,
      }),
    );
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

const sendControlActiveLine = (payload: ControlActiveLineSetOptions | { clear: true }) => {
  let message: string;
  if ("clear" in payload && payload.clear) {
    message = JSON.stringify({ type: "control.activeLine.clear" });
  } else {
    const options = payload as ControlActiveLineSetOptions;
    message = JSON.stringify({
      type: "control.activeLine.set",
      stepIndex: options.stepIndex,
      ...(options.leaseDurationMs !== undefined ? { leaseDurationMs: options.leaseDurationMs } : {}),
      ...(options.leaseTo !== undefined ? { leaseTo: options.leaseTo } : {}),
    });
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    outbox.push(message);
    return;
  }
  socket.send(message);
};

const scheduleReconnect = () => {
  if (!lastConfig || reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    chatClient.connect(lastConfig!);
  }, 1000);
};

export const chatClient = {
  connect: (config: ConnectConfig) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }

    lastConfig = config;
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
        } else if (payload.type === "control.activeLine") {
          useSessionStore.getState().setActiveLine(payload.activeLine ?? null);
        }
      } catch (error) {
        console.error("Failed to parse chat event", error);
      }
    });

    socket.addEventListener("close", (event) => {
      console.warn("Chat socket closed", { code: event.code, reason: event.reason });
      socket = null;
      if (event.code !== 1000 && event.code !== 1001) {
        scheduleReconnect();
      }
    });

    socket.addEventListener("error", (error) => {
      console.error("Chat socket error", error);
      scheduleReconnect();
    });
  },

  disconnect: () => {
    console.trace("chatClient.disconnect");
    if (!socket) return;
    socket.close();
    socket = null;
    outbox.length = 0;
    lastConfig = null;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  },

  sendMessage: (options: SendOptions) => {
    send(options);
  },

  setActiveLine: (options: ControlActiveLineSetOptions) => {
    sendControlActiveLine(options);
  },

  clearActiveLine: () => {
    sendControlActiveLine({ clear: true });
  },
};
