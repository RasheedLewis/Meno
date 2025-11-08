import type { PresenceClientEvent } from "@/lib/presence/types";
import type { ChatMessage } from "@/lib/types/chat";
import type { ActiveLineLease } from "@/lib/store/session";

export const REALTIME_PROTOCOL_VERSION = 1;

export const REALTIME_MESSAGE_TYPE = {
  CHAT_SYNC: 12,
  CHAT_APPEND: 13,
  PRESENCE_SNAPSHOT: 14,
  PRESENCE_EVENT: 15,
  CONTROL_LEASE_STATE: 16,
  CONTROL_LEASE_REQUEST: 17,
} as const;

export type RealtimeMessageType =
  (typeof REALTIME_MESSAGE_TYPE)[keyof typeof REALTIME_MESSAGE_TYPE];

export interface RealtimeChatSyncPayload {
  sessionId: string;
  messages: ChatMessage[];
}

export interface RealtimeChatAppendPayload {
  sessionId: string;
  message: ChatMessage;
}

export interface RealtimePresenceSnapshotPayload {
  sessionId: string;
  participants: RealtimePresenceParticipant[];
  typingSummary: "none" | "single" | "multiple";
  typingIds: string[];
}

export interface RealtimePresenceParticipant {
  participantId: string;
  name: string;
  role: "student" | "teacher" | "observer";
  color: string;
  status: "online" | "typing" | "speaking" | "disconnected" | "muted" | "reconnecting";
  isTyping: boolean;
  isSpeaking: boolean;
  lastSeen: string;
  muted?: boolean;
  addressed?: boolean;
  caption?: string;
  expiresAt?: number;
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
  | RealtimeControlLeaseStatePayload;

export type RealtimeClientMessagePayload =
  | RealtimePresenceEventPayload
  | RealtimeControlLeaseRequestPayload
  | RealtimeChatAppendPayload;

export interface RealtimeMessageEnvelope<TPayload> {
  type: RealtimeMessageType;
  payload: TPayload;
}

export type RealtimeServerMessage = RealtimeMessageEnvelope<RealtimeServerMessagePayload>;

export type RealtimeClientMessage = RealtimeMessageEnvelope<RealtimeClientMessagePayload>;

