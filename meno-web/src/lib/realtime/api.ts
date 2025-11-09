import type { ChatMessage } from "@/lib/types/chat";
import type { PresenceRecord } from "@/lib/presence/types";
import type { ActiveLineLease } from "@/lib/store/session";

export type HydratedPresenceSummary = "none" | "single" | "multiple";

export interface RealtimeSnapshot {
  sessionId: string;
  chat: {
    messages: ChatMessage[];
    count: number;
  };
  presence: {
    participants: PresenceRecord[];
    typingSummary: HydratedPresenceSummary;
    typingIds: string[];
  };
  activeLine: ActiveLineLease | null;
}

interface FetchOptions {
  chatLimit?: number;
  signal?: AbortSignal;
}

export async function fetchRealtimeSnapshot(
  sessionId: string,
  options: FetchOptions = {},
): Promise<RealtimeSnapshot> {
  const params = new URLSearchParams();
  if (options.chatLimit) {
    params.set("chatLimit", String(options.chatLimit));
  }

  const response = await fetch(
    `/api/realtime/session/${encodeURIComponent(sessionId)}${
      params.size ? `?${params.toString()}` : ""
    }`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: options.signal,
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok || !payload.data) {
    const message =
      payload?.error ??
      `Failed to hydrate realtime snapshot (status ${response.status})`;
    throw new Error(message);
  }

  return payload.data as RealtimeSnapshot;
}

