import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL, REALTIME_WS_URL } from '@/constants/config';

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
  const base = REALTIME_WS_URL ?? '';
  if (!base) {
    const fallback = API_BASE_URL.replace(/\/+$/, '').replace(/^http/, 'ws');
    const url = new URL('/api/chat', fallback);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('participantId', participantId);
    url.searchParams.set('name', name);
    url.searchParams.set('role', role);
    url.searchParams.set('client', 'tablet');
    return url.toString();
  }
  const url = new URL(base);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('participantId', participantId);
  url.searchParams.set('name', name);
  url.searchParams.set('role', role);
  url.searchParams.set('client', 'tablet');
  return url.toString();
};

export const useChatControl = ({
  sessionId,
  participantId,
  name,
  role,
}: UseChatControlOptions): ActiveLineLease | null => {
  const [activeLine, setActiveLine] = useState<ActiveLineLease | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setActiveLine(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const hydrate = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/realtime/session/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload.data) {
          throw new Error(payload?.error ?? 'Realtime hydrate failed');
        }

        if (cancelled) return;

        if (payload.data.activeLine) {
          const lease = payload.data.activeLine as ActiveLineLease;
          setActiveLine({
            leaseId: lease.leaseId,
            stepIndex: lease.stepIndex,
            leaseTo: lease.leaseTo,
            leaseIssuedAt: lease.leaseIssuedAt,
            leaseExpiresAt: lease.leaseExpiresAt,
          });
        } else {
          setActiveLine(null);
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        console.warn('[Companion Chat] Failed to hydrate realtime snapshot', error);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId]);

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
                setActiveLine(null);
              } else {
                setActiveLine({
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
  }, [sessionId, participantId, name, role]);

  return activeLine;
};



