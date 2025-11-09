import type { ParticipantRole } from "@/lib/store/session";
import { useChatStore } from "@/lib/store/chat";
import { useSessionStore } from "@/lib/store/session";
import type { ChatMessage } from "@/lib/types/chat";
import {
  ensureRealtimeChannel,
  getRealtimeChannel,
  type RealtimeChannel,
} from "@/lib/realtime/channel";
import type {
  RealtimeChatAppendPayload,
  RealtimeChatSyncPayload,
  RealtimeControlLeaseStatePayload,
} from "@/lib/realtime/messages";
import { env } from "@/env";

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
  createdAt?: string;
  meta?: ChatMessage["meta"];
}

interface ControlActiveLineSetOptions {
  stepIndex: number | null;
  leaseTo?: string | null;
  leaseDurationMs?: number;
}

let channel: RealtimeChannel | null = null;
let lastConfig: ConnectConfig | null = null;
let unsubscribers: Array<() => void> = [];

const detachChannel = () => {
  unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn("[chatClient] failed to unsubscribe handler", error);
    }
  });
  unsubscribers = [];
  channel = null;
};

const handleChatSync = (payload: RealtimeChatSyncPayload) => {
  if (!lastConfig || payload.sessionId !== lastConfig.sessionId) return;
  useChatStore.getState().setMessages(payload.messages);
};

const handleChatAppend = (payload: RealtimeChatAppendPayload) => {
  if (!lastConfig || payload.sessionId !== lastConfig.sessionId) return;
  useChatStore.getState().addMessage(payload.message);
};

const handleLeaseState = (payload: RealtimeControlLeaseStatePayload) => {
  if (!lastConfig || payload.sessionId !== lastConfig.sessionId) return;
  useSessionStore.getState().setActiveLine(payload.activeLine ?? null);
};

const attachChannel = (config: ConnectConfig) => {
  const nextChannel = getRealtimeChannel(config.sessionId) ?? ensureRealtimeChannel(config.sessionId);
  if (channel === nextChannel) {
    channel.connect({
      sessionId: config.sessionId,
      participantId: config.participantId,
      name: config.name,
      role: config.role,
      client: "web",
      url: env.NEXT_PUBLIC_REALTIME_WEBSOCKET_URL ?? env.REALTIME_WEBSOCKET_URL,
    });
    return;
  }
  detachChannel();
  channel = nextChannel;
  unsubscribers = [
    channel.onChatSync(handleChatSync),
    channel.onChatAppend(handleChatAppend),
    channel.onLeaseState(handleLeaseState),
  ];
  channel.connect({
    sessionId: config.sessionId,
    participantId: config.participantId,
    name: config.name,
    role: config.role,
    client: "web",
    url: env.NEXT_PUBLIC_REALTIME_WEBSOCKET_URL ?? env.REALTIME_WEBSOCKET_URL,
  });
};

export const chatClient = {
  connect: (config: ConnectConfig) => {
    lastConfig = config;
    attachChannel(config);
  },

  disconnect: () => {
    detachChannel();
    lastConfig = null;
    useSessionStore.getState().setActiveLine(null);
  },

  sendMessage: (options: SendOptions) => {
    if (!lastConfig) {
      console.warn("[chatClient] sendMessage called before connect");
      return;
    }
    const activeChannel = channel ?? ensureRealtimeChannel(lastConfig.sessionId);
    const message: ChatMessage = {
      id: options.id,
      role: options.role,
      content: options.content,
      createdAt: options.createdAt ?? new Date().toISOString(),
      meta: {
        ...options.meta,
        sessionId: lastConfig.sessionId,
        participantId: lastConfig.participantId,
      },
    };
    activeChannel.sendChatAppend({
      sessionId: lastConfig.sessionId,
      message,
    });
  },

  setActiveLine: (options: ControlActiveLineSetOptions) => {
    if (!lastConfig) {
      console.warn("[chatClient] setActiveLine called before connect");
      return;
    }
    const activeChannel = channel ?? ensureRealtimeChannel(lastConfig.sessionId);
    activeChannel.sendLeaseRequest({
      sessionId: lastConfig.sessionId,
      stepIndex: options.stepIndex,
      leaseTo: options.leaseTo ?? lastConfig.participantId,
      leaseDurationMs: options.leaseDurationMs,
    });
  },

  clearActiveLine: () => {
    if (!lastConfig) {
      console.warn("[chatClient] clearActiveLine called before connect");
      return;
    }
    const activeChannel = channel ?? ensureRealtimeChannel(lastConfig.sessionId);
    activeChannel.sendLeaseRequest({
      sessionId: lastConfig.sessionId,
      stepIndex: null,
    });
  },
};
