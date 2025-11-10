import { useCallback, useEffect, useRef, useState } from 'react';

import { REALTIME_WS_URL } from '@/constants/config';
import { fetchLease, takeLease, releaseLease } from '@/lib/api/lease';

export interface ActiveLineLease {
  leaseId: string;
  stepIndex: number | null;
  leaseTo: string | null;
  leaseIssuedAt: string;
  leaseExpiresAt: number;
}

interface UseChatControlOptions {
  sessionId: string | null;
  participantId: string | null;
  name: string;
  role: 'companion' | 'student' | 'teacher' | 'observer';
}

type ServerEnvelope =
  | {
      type: 'control.lease.state';
      data: {
        sessionId: string;
        leaseId: string | null;
        stepIndex: number | null;
        leaseTo: string | null;
        leaseIssuedAt: string | null;
        leaseExpiresAt: number | null;
      };
    }
  | {
      type: 'system.pong';
      data: { timestamp: number };
    }
  | {
      type: string;
      data: unknown;
    };

const buildWebsocketUrl = (sessionId: string, participantId: string, name: string, role: string) => {
  if (!REALTIME_WS_URL) {
    throw new Error(
      'REALTIME_WS_URL must be defined (expo extra.realtimeWsUrl) to connect to the realtime channel',
    );
  }
  const url = new URL(REALTIME_WS_URL);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('participantId', participantId);
  url.searchParams.set('name', name);
  url.searchParams.set('role', role);
  url.searchParams.set('client', 'tablet');
  return url.toString();
};

interface UseChatControlResult {
  activeLine: ActiveLineLease | null;
  isMutating: boolean;
  isHydrating: boolean;
  takeControl: (stepIndex: number) => Promise<boolean>;
  releaseControl: () => Promise<boolean>;
  setActiveLineState: (lease: ActiveLineLease | null) => void;
}

export const useChatControl = ({
  sessionId,
  participantId,
  name,
  role,
}: UseChatControlOptions): UseChatControlResult => {
  const [activeLine, setActiveLine] = useState<ActiveLineLease | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const setActiveLineState = useCallback((lease: ActiveLineLease | null) => {
    if (!lease) {
      setActiveLine(null);
      return;
    }
    const leaseExpiresAt =
      typeof lease.leaseExpiresAt === 'number' && Number.isFinite(lease.leaseExpiresAt)
        ? lease.leaseExpiresAt
        : Date.now() + 30_000;
    setActiveLine({
      leaseId: lease.leaseId,
      stepIndex: typeof lease.stepIndex === 'number' ? lease.stepIndex : null,
      leaseTo: lease.leaseTo ?? null,
      leaseIssuedAt: lease.leaseIssuedAt ?? new Date().toISOString(),
      leaseExpiresAt,
    });
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setActiveLine(null);
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const hydrate = async () => {
      try {
        setIsHydrating(true);
        const payload = await fetchLease(sessionId);
        if (!payload?.ok || cancelled) {
          if (payload && !payload.ok) {
            console.warn('[Companion Chat] Lease hydrate failed', payload.error);
          }
          return;
        }

        if (cancelled) return;

        setActiveLineState(payload.data);
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        console.warn('[Companion Chat] Failed to hydrate realtime snapshot', error);
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
      controller.abort();
      setIsHydrating(false);
    };
  }, [sessionId, setActiveLineState]);

  useEffect(() => {
    if (!sessionId || !participantId) {
      return () => {
        wsRef.current?.close();
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }
      try {
        const ws = new WebSocket(buildWebsocketUrl(sessionId, participantId, name, role));
        wsRef.current = ws;

        ws.onopen = () => {
          try {
            ws.send(JSON.stringify({ action: 'system.ping', payload: {} }));
          } catch (error) {
            console.warn('[Companion Chat] Failed to send ping', error);
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as ServerEnvelope;
            if (payload.type === 'control.lease.state') {
              const lease = payload.data;
              if (!lease || lease.stepIndex === null) {
                setActiveLineState(null);
              } else {
                setActiveLineState({
                  leaseId: lease.leaseId ?? '',
                  stepIndex: lease.stepIndex,
                  leaseTo: lease.leaseTo,
                  leaseIssuedAt: lease.leaseIssuedAt ?? new Date().toISOString(),
                  leaseExpiresAt: lease.leaseExpiresAt ?? Date.now(),
                });
              }
            }
          } catch (error) {
            console.warn('[Companion Chat] Failed to parse event', error);
          }
        };

        const scheduleReconnect = () => {
          if (cancelled) return;
          if (reconnectTimerRef.current) return;
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, 1500);
        };

        ws.onclose = () => {
          wsRef.current = null;
          scheduleReconnect();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (error) {
        console.warn('[Companion Chat] Failed to open websocket', error);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, 1500);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, participantId, name, role, setActiveLineState]);

  const handleTakeControl = useCallback(
    async (stepIndex: number) => {
      if (!sessionId || !participantId) return false;
      setIsMutating(true);
      try {
        const payload = await takeLease(sessionId, {
          stepIndex,
          leaseTo: participantId,
        });
        if (!payload.ok) {
          console.warn('[Companion Chat] Failed to take lease', payload.error);
          return false;
        }
        setActiveLineState(payload.data);
        return true;
      } catch (error) {
        console.warn('[Companion Chat] take control failed', error);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [participantId, sessionId],
  );

  const handleReleaseControl = useCallback(async () => {
    if (!sessionId) return false;
    setIsMutating(true);
    try {
      const payload = await releaseLease(sessionId);
      if (!payload.ok) {
        console.warn('[Companion Chat] Failed to release lease', payload.error);
        return false;
      }
      setActiveLineState(payload.data);
      return true;
    } catch (error) {
      console.warn('[Companion Chat] release control failed', error);
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [sessionId, setActiveLineState]);

  return {
    activeLine,
    isHydrating,
    isMutating,
    takeControl: handleTakeControl,
    releaseControl: handleReleaseControl,
    setActiveLineState,
  };
};



