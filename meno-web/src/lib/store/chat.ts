import { create } from "zustand";

import type { ChatMessage, ChatTranscript } from "@/lib/types/chat";

const createMessageId = () => {
  const globalCrypto =
    typeof crypto !== "undefined"
      ? (crypto as Crypto & { randomUUID?: () => string })
      : undefined;

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  return `msg-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

const nowIso = () => new Date().toISOString();

const seedTimestamp = "2024-01-01T00:00:00.000Z";

const seedTranscript: ChatTranscript = [
  {
    id: "seed-meno-welcome",
    role: "meno",
    content:
      "Welcome. When you feel ready, tell me what part of this problem you want to untangle first.",
    createdAt: seedTimestamp,
    meta: {
      source: "system",
      channel: "public",
      tags: ["greeting"],
    },
  },
  {
    id: "seed-student-question",
    role: "student",
    content: "I'm stuck isolating x in 2x + 5 = 13.",
    createdAt: seedTimestamp,
    meta: {
      source: "chat",
      channel: "public",
    },
  },
  {
    id: "seed-meno-followup",
    role: "meno",
    content: "Good. What's the very last thing happening to x on the left-hand side?",
    createdAt: seedTimestamp,
    meta: {
      source: "chat",
      channel: "public",
      tags: ["prompt"],
    },
  },
];

interface ChatState {
  messages: ChatTranscript;
  isStreaming: boolean;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updater: Partial<ChatMessage>) => void;
  setMessages: (messages: ChatTranscript) => void;
  clearMessages: () => void;
  startStreaming: () => void;
  stopStreaming: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: seedTranscript,
  isStreaming: false,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updater) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...updater } : message,
      ),
    })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [], isStreaming: false }),
  startStreaming: () => set({ isStreaming: true }),
  stopStreaming: () => set({ isStreaming: false }),
}));

export const createChatMessage = (
  role: ChatMessage["role"],
  content: string,
  meta?: ChatMessage["meta"],
): ChatMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: nowIso(),
  meta,
});

export const chatSeedTranscript = seedTranscript;

