import { env } from "@/env";
import type {
  RealtimeChatAppendPayload,
  RealtimeChatSyncPayload,
  RealtimeClientAction,
  RealtimeControlLeaseRequestPayload,
  RealtimeControlLeaseStatePayload,
  RealtimePresenceEventPayload,
  RealtimePresenceSnapshotPayload,
  RealtimeServerEnvelope,
  RealtimeServerEvent,
} from "@/lib/realtime/messages";

type MessageListener<TPayload> = (payload: TPayload) => void;

interface RealtimeConnectionConfig {
  sessionId: string;
  participantId: string;
  name: string;
  role: string;
  client?: string;
  url?: string;
}

interface PendingAction {
  action: RealtimeClientAction;
  payload: unknown;
}

const DEFAULT_CLIENT = "web";
const RECONNECT_DELAY_MS = 1_500;

const isBrowser = () => typeof window !== "undefined";

const resolveBaseUrl = () => {
  if (typeof window !== "undefined") {
    return env.NEXT_PUBLIC_REALTIME_WEBSOCKET_URL ?? env.REALTIME_WEBSOCKET_URL;
  }
  return env.REALTIME_WEBSOCKET_URL ?? process.env.NEXT_PUBLIC_REALTIME_WEBSOCKET_URL;
};

class RealtimeChannel {
  readonly roomId: string;
  private socket: WebSocket | null = null;
  private queue: PendingAction[] = [];
  private listeners = new Map<RealtimeServerEvent, Set<MessageListener<any>>>();
  private config: RealtimeConnectionConfig | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  connect(config: RealtimeConnectionConfig) {
    const normalized: RealtimeConnectionConfig = {
      ...config,
      client: config.client ?? DEFAULT_CLIENT,
    };
    const isSameConfig =
      this.config &&
      this.config.sessionId === normalized.sessionId &&
      this.config.participantId === normalized.participantId &&
      this.config.name === normalized.name &&
      this.config.role === normalized.role &&
      this.config.client === normalized.client &&
      this.config.url === normalized.url;

    this.config = normalized;

    if (isSameConfig && this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }

    this.openSocket(true);
  }

  disconnect() {
    this.config = null;
    this.queue = [];
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.removeEventListener("open", this.handleOpen);
      this.socket.removeEventListener("close", this.handleClose);
      this.socket.removeEventListener("error", this.handleError);
      this.socket.removeEventListener("message", this.handleMessage);
      try {
        this.socket.close();
      } catch {
        /* noop */
      }
    }
    this.socket = null;
  }

  dispose() {
    this.disconnect();
    this.listeners.clear();
  }

  on<TPayload>(type: RealtimeServerEvent, handler: MessageListener<TPayload>): () => void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler as MessageListener<any>);
    this.listeners.set(type, set);
    return () => {
      const current = this.listeners.get(type);
      if (!current) return;
      current.delete(handler as MessageListener<any>);
      if (current.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  send(action: RealtimeClientAction, payload: unknown) {
    if (!this.config) {
      console.warn("[Realtime] send called before connect");
      return;
    }
    const envelope = JSON.stringify({ action, payload });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(envelope);
    } else {
      this.queue.push({ action, payload });
      this.openSocket(false);
    }
  }

  sendChatAppend(payload: RealtimeChatAppendPayload) {
    this.send("chat.send", payload);
  }

  sendPresenceEvent(payload: RealtimePresenceEventPayload) {
    this.send("presence.update", payload);
  }

  sendPresenceHeartbeat(payload: { sessionId: string; participantId: string }) {
    this.send("presence.heartbeat", payload);
  }

  sendLeaseRequest(payload: RealtimeControlLeaseRequestPayload) {
    if (payload.stepIndex === null) {
      this.send("control.lease.release", { sessionId: payload.sessionId });
    } else {
      this.send("control.lease.set", payload);
    }
  }

  sendPing() {
    this.send("system.ping", {});
  }

  onChatSync(handler: MessageListener<RealtimeChatSyncPayload>) {
    return this.on("chat.sync", handler);
  }

  onChatAppend(handler: MessageListener<RealtimeChatAppendPayload>) {
    return this.on("chat.message", handler);
  }

  onPresenceSnapshot(handler: MessageListener<RealtimePresenceSnapshotPayload>) {
    return this.on("presence.snapshot", handler);
  }

  onPresenceEvent(handler: MessageListener<RealtimePresenceEventPayload>) {
    return this.on("presence.event", handler);
  }

  onLeaseState(handler: MessageListener<RealtimeControlLeaseStatePayload>) {
    return this.on("control.lease.state", handler);
  }

  private openSocket(force: boolean) {
    if (!isBrowser()) {
      return;
    }
    if (!this.config) {
      return;
    }
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      if (!force) {
        return;
      }
      this.disconnect();
    }

    const baseUrl = this.config.url ?? resolveBaseUrl();
    if (!baseUrl) {
      console.error(
        "[Realtime] REALTIME_WEBSOCKET_URL/NEXT_PUBLIC_REALTIME_WEBSOCKET_URL is not configured",
      );
      return;
    }

    try {
      const url = new URL(baseUrl);
      url.searchParams.set("sessionId", this.config.sessionId);
      url.searchParams.set("participantId", this.config.participantId);
      url.searchParams.set("name", this.config.name);
      url.searchParams.set("role", this.config.role);
      url.searchParams.set("client", this.config.client ?? DEFAULT_CLIENT);

      const socket = new WebSocket(url.toString());
      this.socket = socket;
      this.clearReconnectTimer();

      socket.addEventListener("open", this.handleOpen);
      socket.addEventListener("close", this.handleClose);
      socket.addEventListener("error", this.handleError);
      socket.addEventListener("message", this.handleMessage);
    } catch (error) {
      console.error("[Realtime] Failed to open websocket", error);
      this.scheduleReconnect();
    }
  }

  private flushQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) continue;
      try {
        this.socket.send(JSON.stringify(next));
      } catch (error) {
        console.error("[Realtime] Failed to send frame", error);
        break;
      }
    }
  }

  private readonly handleOpen = () => {
    this.flushQueue();
  };

  private readonly handleClose = () => {
    this.scheduleReconnect();
  };

  private readonly handleError = () => {
    this.scheduleReconnect();
  };

  private readonly handleMessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== "string") {
      return;
    }
    try {
      const envelope = JSON.parse(event.data as string) as RealtimeServerEnvelope<any>;
      if (!envelope || typeof envelope.type !== "string") {
        return;
      }
      const listeners = this.listeners.get(envelope.type as RealtimeServerEvent);
      if (!listeners || listeners.size === 0) {
        return;
      }
      listeners.forEach((listener) => {
        try {
          listener(envelope.data);
        } catch (error) {
          console.error("[Realtime] Listener error", error);
        }
      });
    } catch (error) {
      console.warn("[Realtime] Failed to parse message", error);
    }
  };

  private scheduleReconnect() {
    if (!this.config) {
      return;
    }
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(false);
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

const channels = new Map<string, RealtimeChannel>();

export const ensureRealtimeChannel = (roomId: string) => {
  let channel = channels.get(roomId);
  if (!channel) {
    channel = new RealtimeChannel(roomId);
    channels.set(roomId, channel);
  }
  return channel;
};

export const getRealtimeChannel = (roomId: string) => channels.get(roomId) ?? null;

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
  channel.disconnect();
};

export type { RealtimeChannel, RealtimeConnectionConfig };

