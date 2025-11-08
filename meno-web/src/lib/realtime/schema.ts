export type WebsocketAction =
  | "chat.send"
  | "presence.update"
  | "presence.heartbeat"
  | "control.lease.set"
  | "control.lease.release"
  | "system.ping";

export type ParticipantRole = "student" | "teacher" | "observer";

export interface ConnectionMetadata {
  sessionId: string;
  participantId: string;
  name: string;
  role: ParticipantRole;
  client: "web" | "tablet" | "native";
}

export interface ChatSendPayload {
  messageId: string;
  content: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

export interface PresenceUpdatePayload {
  status?: "online" | "typing" | "speaking" | "muted" | "reconnecting";
  isTyping?: boolean;
  isSpeaking?: boolean;
  lastSeen?: string;
  extra?: Record<string, unknown>;
}

export interface PresenceHeartbeatPayload {
  lastSeen?: string;
}

export interface ControlLeaseSetPayload {
  leaseId?: string;
  stepIndex: number;
  leaseDurationMs?: number;
}

export interface ControlLeaseReleasePayload {
  leaseId?: string;
}

export type WebsocketClientEnvelope =
  | {
      action: "chat.send";
      payload: ChatSendPayload;
    }
  | {
      action: "presence.update";
      payload: PresenceUpdatePayload;
    }
  | {
      action: "presence.heartbeat";
      payload: PresenceHeartbeatPayload;
    }
  | {
      action: "control.lease.set";
      payload: ControlLeaseSetPayload;
    }
  | {
      action: "control.lease.release";
      payload: ControlLeaseReleasePayload;
    }
  | {
      action: "system.ping";
      payload?: Record<string, never>;
    };

export interface ChatMessageBroadcast {
  type: "chat.message";
  data: {
    sessionId: string;
    messageId: string;
    participantId: string;
    participantName: string;
    role: ParticipantRole;
    content: string;
    createdAt: string;
    meta?: Record<string, unknown>;
  };
}

export interface ChatSyncBroadcast {
  type: "chat.sync";
  data: {
    sessionId: string;
    messages: ChatMessageBroadcast["data"][];
  };
}

export interface PresenceSnapshotBroadcast {
  type: "presence.snapshot";
  data: {
    sessionId: string;
    participants: Array<{
      participantId: string;
      name: string;
      role: ParticipantRole;
      status: "online" | "typing" | "speaking" | "muted" | "reconnecting" | "offline";
      isTyping: boolean;
      isSpeaking: boolean;
      color?: string;
      lastSeen: string;
      extra?: Record<string, unknown>;
    }>;
  };
}

export interface PresenceEventBroadcast {
  type: "presence.event";
  data: {
    sessionId: string;
    participantId: string;
    status: "online" | "typing" | "speaking" | "muted" | "reconnecting" | "offline";
    isTyping: boolean;
    isSpeaking: boolean;
    lastSeen: string;
    extra?: Record<string, unknown>;
  };
}

export interface LeaseStateBroadcast {
  type: "control.lease.state";
  data: {
    sessionId: string;
    leaseId: string | null;
    stepIndex: number | null;
    leaseTo: string | null;
    leaseIssuedAt: string | null;
    leaseExpiresAt: number | null;
  };
}

export interface SystemPongBroadcast {
  type: "system.pong";
  data: {
    timestamp: number;
  };
}

export type WebsocketServerEnvelope =
  | ChatMessageBroadcast
  | ChatSyncBroadcast
  | PresenceSnapshotBroadcast
  | PresenceEventBroadcast
  | LeaseStateBroadcast
  | SystemPongBroadcast;

