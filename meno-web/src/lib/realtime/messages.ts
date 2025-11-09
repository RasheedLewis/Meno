import type { PresenceClientEvent } from "@/lib/presence/types";
import type { ChatMessage } from "@/lib/types/chat";
import type { ActiveLineLease } from "@/lib/store/session";

export type RealtimeClientAction =
  | "chat.send"
  | "presence.update"
  | "presence.heartbeat"
  | "control.lease.set"
  | "control.lease.release"
  | "system.ping";

export type RealtimeServerEvent =
  | "chat.sync"
  | "chat.message"
  | "presence.snapshot"
  | "presence.event"
  | "control.lease.state"
  | "system.pong";

export interface RealtimeChatSyncPayload {
  sessionId: string;
  messages: ChatMessage[];
}

export interface RealtimeChatAppendPayload {
  sessionId: string;
  message: ChatMessage;
}

export interface RealtimePresenceParticipant {
  sessionId: string;
  participantId: string;
  name: string;
  role: "student" | "teacher" | "observer";
  color?: string;
  status: "online" | "typing" | "speaking" | "disconnected" | "muted" | "reconnecting" | "offline";
  isTyping: boolean;
  isSpeaking: boolean;
  lastSeen: string;
  muted?: boolean;
  addressed?: boolean;
  caption?: string;
  expiresAt?: number;
  extra?: Record<string, unknown>;
}

export interface RealtimePresenceSnapshotPayload {
  sessionId: string;
  participants: RealtimePresenceParticipant[];
  typingSummary: "none" | "single" | "multiple";
  typingIds: string[];
}

export interface RealtimePresenceEventPayload {
  sessionId: string;
  participantId: string;
  event: PresenceClientEvent;
  record?: RealtimePresenceParticipant;
}

export interface RealtimeControlLeaseStatePayload {
  sessionId: string;
  activeLine: ActiveLineLease | null;
}

export interface RealtimeControlLeaseRequestPayload {
  sessionId: string;
  stepIndex: number | null;
  leaseTo?: string | null;
  leaseDurationMs?: number;
}

export type RealtimeServerMessagePayload =
  | RealtimeChatSyncPayload
  | RealtimeChatAppendPayload
  | RealtimePresenceSnapshotPayload
  | RealtimePresenceEventPayload
  | RealtimeControlLeaseStatePayload
  | { timestamp: number };

export type RealtimeClientMessagePayload =
  | RealtimeChatAppendPayload
  | RealtimePresenceEventPayload
  | RealtimeControlLeaseRequestPayload
  | Record<string, never>;

export interface RealtimeServerEnvelope<TPayload extends RealtimeServerMessagePayload> {
  type: RealtimeServerEvent;
  data: TPayload;
}

export interface RealtimeClientEnvelope<TPayload extends RealtimeClientMessagePayload> {
  action: RealtimeClientAction;
  payload: TPayload;
}

