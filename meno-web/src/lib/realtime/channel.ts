import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

import type { WebsocketProvider } from "y-websocket";

import {
  REALTIME_MESSAGE_TYPE,
  type RealtimeChatAppendPayload,
  type RealtimeChatSyncPayload,
  type RealtimeClientMessagePayload,
  type RealtimeControlLeaseRequestPayload,
  type RealtimeControlLeaseStatePayload,
  type RealtimeMessageType,
  type RealtimePresenceEventPayload,
  type RealtimePresenceSnapshotPayload,
  type RealtimeServerMessagePayload,
} from "@/lib/realtime/messages";

type MessageListener<TPayload> = (payload: TPayload) => void;

const CUSTOM_MESSAGE_MIN = REALTIME_MESSAGE_TYPE.CHAT_SYNC;

const toUint8Array = (data: unknown): Uint8Array | null => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    // Blob -> ArrayBuffer conversion is async; enqueue conversion.
    return null;
  }
  if (typeof data === "string") {
    return null;
  }
  return null;
};

const encodeMessage = (type: RealtimeMessageType, payload: RealtimeClientMessagePayload): Uint8Array => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  encoding.writeVarString(encoder, JSON.stringify(payload));
  return encoding.toUint8Array(encoder);
};

const decodeMessage = (
  buffer: Uint8Array,
): { type: RealtimeMessageType; payload: RealtimeServerMessagePayload | null } | null => {
  try {
    const decoder = decoding.createDecoder(buffer);
    const type = decoding.readVarUint(decoder) as RealtimeMessageType;
    if (type < CUSTOM_MESSAGE_MIN) {
      return null;
    }
    const payloadJson = decoding.hasContent(decoder) ? decoding.readVarString(decoder) : "";
    const payload = payloadJson ? (JSON.parse(payloadJson) as RealtimeServerMessagePayload) : null;
    return { type, payload };
  } catch (error) {
    console.error("[Realtime] Failed to decode message", error);
    return null;
  }
};

class RealtimeChannel {
  readonly roomId: string;
  private provider: WebsocketProvider | null = null;
  private socket: WebSocket | null = null;
  private queue: Uint8Array[] = [];
  private listeners = new Map<RealtimeMessageType, Set<MessageListener<RealtimeServerMessagePayload>>>();
  private statusHandlersBound = false;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  attachProvider(provider: WebsocketProvider) {
    if (this.provider === provider) {
      this.bindSocket();
      return;
    }
    this.detachProvider();
    this.provider = provider;
    if (!this.statusHandlersBound) {
      provider.on("status", this.handleStatus);
      this.statusHandlersBound = true;
    }
    this.bindSocket();
  }

  detachProvider() {
    if (!this.provider) {
      return;
    }
    if (this.statusHandlersBound) {
      this.provider.off("status", this.handleStatus);
      this.statusHandlersBound = false;
    }
    this.provider = null;
    this.unbindSocket();
  }

  dispose() {
    this.detachProvider();
    this.listeners.clear();
    this.queue = [];
  }

  on<TPayload extends RealtimeServerMessagePayload>(
    type: RealtimeMessageType,
    handler: MessageListener<TPayload>,
  ): () => void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler as MessageListener<RealtimeServerMessagePayload>);
    this.listeners.set(type, set);
    return () => {
      const current = this.listeners.get(type);
      if (!current) return;
      current.delete(handler as MessageListener<RealtimeServerMessagePayload>);
      if (current.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  send(type: RealtimeMessageType, payload: RealtimeClientMessagePayload) {
    const frame = encodeMessage(type, payload);
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(frame);
      return;
    }
    this.queue.push(frame);
  }

  sendChatAppend(payload: RealtimeChatAppendPayload) {
    this.send(REALTIME_MESSAGE_TYPE.CHAT_APPEND, payload);
  }

  sendPresenceEvent(payload: RealtimePresenceEventPayload) {
    this.send(REALTIME_MESSAGE_TYPE.PRESENCE_EVENT, payload);
  }

  sendLeaseRequest(payload: RealtimeControlLeaseRequestPayload) {
    this.send(REALTIME_MESSAGE_TYPE.CONTROL_LEASE_REQUEST, payload);
  }

  onChatSync(handler: MessageListener<RealtimeChatSyncPayload>) {
    return this.on(REALTIME_MESSAGE_TYPE.CHAT_SYNC, handler);
  }

  onChatAppend(handler: MessageListener<RealtimeChatAppendPayload>) {
    return this.on(REALTIME_MESSAGE_TYPE.CHAT_APPEND, handler);
  }

  onPresenceSnapshot(handler: MessageListener<RealtimePresenceSnapshotPayload>) {
    return this.on(REALTIME_MESSAGE_TYPE.PRESENCE_SNAPSHOT, handler);
  }

  onPresenceEvent(handler: MessageListener<RealtimePresenceEventPayload>) {
    return this.on(REALTIME_MESSAGE_TYPE.PRESENCE_EVENT, handler);
  }

  onLeaseState(handler: MessageListener<RealtimeControlLeaseStatePayload>) {
    return this.on(REALTIME_MESSAGE_TYPE.CONTROL_LEASE_STATE, handler);
  }

  private flushQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.queue.length > 0) {
      const frame = this.queue.shift();
      if (frame) {
        this.socket.send(frame);
      }
    }
  }

  private bindSocket() {
    const nextSocket = this.provider?.ws ?? null;
    if (!nextSocket || nextSocket === this.socket) {
      return;
    }

    this.unbindSocket();
    this.socket = nextSocket;
    this.socket.binaryType = "arraybuffer";
    this.socket.addEventListener("open", this.handleOpen);
    this.socket.addEventListener("close", this.handleClose);
    this.socket.addEventListener("message", this.handleMessage);
    if (this.socket.readyState === WebSocket.OPEN) {
      this.flushQueue();
    }
  }

  private unbindSocket() {
    if (!this.socket) {
      return;
    }
    this.socket.removeEventListener("open", this.handleOpen);
    this.socket.removeEventListener("close", this.handleClose);
    this.socket.removeEventListener("message", this.handleMessage);
    this.socket = null;
  }

  private readonly handleOpen = () => {
    this.flushQueue();
  };

  private readonly handleClose = () => {
    // On reconnect a new socket instance will be attached.
    this.bindSocket();
  };

  private readonly handleMessage = (event: MessageEvent<unknown>) => {
    const bytes = toUint8Array(event.data);
    if (!bytes) {
      return;
    }
    const decoded = decodeMessage(bytes);
    if (!decoded || !decoded.payload) {
      return;
    }
    const listeners = this.listeners.get(decoded.type);
    if (!listeners || listeners.size === 0) {
      return;
    }
    listeners.forEach((listener) => {
      try {
        listener(decoded.payload);
      } catch (error) {
        console.error("[Realtime] Listener error", error);
      }
    });
  };

  private readonly handleStatus = (event: { status: "connected" | "disconnected" }) => {
    if (event.status === "connected") {
      this.bindSocket();
      this.flushQueue();
    }
  };
}

const channels = new Map<string, RealtimeChannel>();
const waiters = new Map<string, Set<(channel: RealtimeChannel) => void>>();

export const ensureRealtimeChannel = (roomId: string, provider?: WebsocketProvider) => {
  let channel = channels.get(roomId);
  if (!channel) {
    channel = new RealtimeChannel(roomId);
    channels.set(roomId, channel);
    const pending = waiters.get(roomId);
    if (pending) {
      pending.forEach((handler) => handler(channel!));
      waiters.delete(roomId);
    }
  }
  if (provider) {
    channel.attachProvider(provider);
  }
  return channel;
};

export const getRealtimeChannel = (roomId: string) => channels.get(roomId) ?? null;

export const waitForRealtimeChannel = (roomId: string): Promise<RealtimeChannel> => {
  const existing = channels.get(roomId);
  if (existing) {
    return Promise.resolve(existing);
  }
  return new Promise<RealtimeChannel>((resolve) => {
    const set = waiters.get(roomId) ?? new Set();
    set.add(resolve);
    waiters.set(roomId, set);
  });
};

export const removeRealtimeChannel = (roomId: string) => {
  const channel = channels.get(roomId);
  if (!channel) {
    return;
  }
  channel.dispose();
  channels.delete(roomId);
};

export const detachRealtimeChannelProvider = (roomId: string) => {
  const channel = channels.get(roomId);
  if (!channel) {
    return;
  }
  channel.detachProvider();
};

export type { RealtimeChannel };

