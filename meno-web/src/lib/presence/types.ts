export type PresenceStatus = "online" | "typing" | "speaking" | "disconnected";

export interface PresenceRecord {
  sessionId: string;
  participantId: string;
  name: string;
  role: "student" | "teacher" | "observer";
  color: string;
  status: PresenceStatus;
  isTyping: boolean;
  isSpeaking: boolean;
  lastSeen: string;
  expiresAt?: number;
}

export interface PresenceSnapshot extends PresenceRecord {
  connectionId?: string;
}

export interface PresenceBroadcast {
  type: "presence.sync";
  sessionId: string;
  participants: PresenceRecord[];
  typingSummary: "none" | "single" | "multiple";
  typingIds: string[];
}

export interface PresenceTypingEvent {
  type: "typing";
  isTyping: boolean;
}

export interface PresenceSpeakEvent {
  type: "speaking";
  isSpeaking: boolean;
}

export interface PresenceJoinEvent {
  type: "join";
  sessionId: string;
  participantId: string;
  name: string;
  role: "student" | "teacher" | "observer";
}

export interface PresenceHeartbeatEvent {
  type: "heartbeat";
}

export type PresenceClientEvent =
  | PresenceJoinEvent
  | PresenceTypingEvent
  | PresenceSpeakEvent
  | PresenceHeartbeatEvent;
