import type { ParticipantRole } from "@/lib/store/session";
import { usePresenceStore } from "@/lib/store/presence";
import { ensureRealtimeChannel, getRealtimeChannel } from "@/lib/realtime/channel";
import type {
  RealtimePresenceEventPayload,
  RealtimePresenceParticipant,
  RealtimePresenceSnapshotPayload,
} from "@/lib/realtime/messages";
import type { PresenceRecord } from "@/lib/presence/types";

interface ConnectConfig {
  sessionId: string;
  participantId: string;
  name: string;
  role: ParticipantRole;
}

const HEARTBEAT_MS = 20_000;

let lastConfig: ConnectConfig | null = null;
let channelUnsubscribers: Array<() => void> = [];
let heartbeatId: ReturnType<typeof setInterval> | null = null;
let lastTypingState = false;

const toPresenceRecord = (participant: RealtimePresenceParticipant): PresenceRecord => ({
  sessionId: participant.sessionId,
  participantId: participant.participantId,
  name: participant.name,
  role: participant.role,
  color: participant.color,
  status: participant.status,
  isTyping: participant.isTyping,
  isSpeaking: participant.isSpeaking,
  lastSeen: participant.lastSeen,
  muted: participant.muted,
  addressed: participant.addressed,
  caption: participant.caption,
  expiresAt: participant.expiresAt,
});

const handleSnapshot = (payload: RealtimePresenceSnapshotPayload) => {
  if (!lastConfig || payload.sessionId !== lastConfig.sessionId) return;
  const participants = payload.participants.map(toPresenceRecord);
  usePresenceStore.getState().setParticipants(participants, payload.typingSummary, payload.typingIds);
  usePresenceStore.getState().setConnectionState("open");
};

const handlePresenceEvent = (payload: RealtimePresenceEventPayload) => {
  if (!lastConfig || payload.sessionId !== lastConfig.sessionId) return;
  usePresenceStore.getState().setConnectionState("open");
  if (payload.record) {
    const snapshot = usePresenceStore.getState().participants.slice();
    const index = snapshot.findIndex((item) => item.participantId === payload.record?.participantId);
    const record = toPresenceRecord(payload.record);
    if (index >= 0) {
      snapshot[index] = record;
    } else {
      snapshot.push(record);
    }
    const typingIds = snapshot.filter((item) => item.isTyping).map((item) => item.participantId);
    const typingSummary = typingIds.length === 0 ? "none" : typingIds.length === 1 ? "single" : "multiple";
    usePresenceStore.getState().setParticipants(snapshot, typingSummary, typingIds);
  }
};

const attachChannel = (config: ConnectConfig) => {
  const channel = getRealtimeChannel(config.sessionId) ?? ensureRealtimeChannel(config.sessionId);
  channelUnsubscribers.forEach((unsubscribe) => unsubscribe());
  channelUnsubscribers = [
    channel.onPresenceSnapshot(handleSnapshot),
    channel.onPresenceEvent(handlePresenceEvent),
  ];
  channel.sendPresenceEvent({
    sessionId: config.sessionId,
    participantId: config.participantId,
    event: {
      type: "join",
      sessionId: config.sessionId,
      participantId: config.participantId,
      name: config.name,
      role: config.role,
    },
  });
  if (heartbeatId) {
    clearInterval(heartbeatId);
  }
  heartbeatId = setInterval(() => {
    channel.sendPresenceEvent({
      sessionId: config.sessionId,
      participantId: config.participantId,
      event: { type: "heartbeat" },
    });
  }, HEARTBEAT_MS);
};

export const presenceClient = {
  connect: (config: ConnectConfig) => {
    lastConfig = config;
    lastTypingState = false;
    usePresenceStore.getState().setConnectionState("connecting");
    attachChannel(config);
  },

  disconnect: () => {
    channelUnsubscribers.forEach((unsubscribe) => unsubscribe());
    channelUnsubscribers = [];
    if (heartbeatId) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
    usePresenceStore.getState().reset();
    usePresenceStore.getState().setConnectionState("closed");
    lastConfig = null;
    lastTypingState = false;
  },

  setTyping: (isTyping: boolean) => {
    if (!lastConfig) return;
    if (isTyping === lastTypingState) return;
    lastTypingState = isTyping;
    const channel = getRealtimeChannel(lastConfig.sessionId) ?? ensureRealtimeChannel(lastConfig.sessionId);
    channel.sendPresenceEvent({
      sessionId: lastConfig.sessionId,
      participantId: lastConfig.participantId,
      event: { type: "typing", isTyping },
    });
  },

  setSpeaking: (isSpeaking: boolean) => {
    if (!lastConfig) return;
    const channel = getRealtimeChannel(lastConfig.sessionId) ?? ensureRealtimeChannel(lastConfig.sessionId);
    channel.sendPresenceEvent({
      sessionId: lastConfig.sessionId,
      participantId: lastConfig.participantId,
      event: { type: "speaking", isSpeaking },
    });
  },
};
