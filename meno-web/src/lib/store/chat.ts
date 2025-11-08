import { create } from "zustand";

import type { ChatMessage, ChatTranscript } from "@/lib/types/chat";
import { randomId } from "@/lib/utils/random";

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
  addMessages: (messages: ChatTranscript) => void;
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
    set((state) => {
      const exists = state.messages.some((existing) => existing.id === message.id);
      if (exists) {
        return {
          messages: state.messages.map((existing) =>
            existing.id === message.id ? { ...existing, ...message } : existing,
          ),
        };
      }
      return { messages: [...state.messages, message] };
    }),
  addMessages: (messages) =>
    set((state) => {
      const merged = [...state.messages];
      messages.forEach((message) => {
        const index = merged.findIndex((existing) => existing.id === message.id);
        if (index >= 0) {
          merged[index] = { ...merged[index], ...message };
        } else {
          merged.push(message);
        }
      });
      return {
        messages: merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      };
    }),
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
  id: randomId("msg"),
  role,
  content,
  createdAt: nowIso(),
  meta,
});

export const chatSeedTranscript = seedTranscript;

