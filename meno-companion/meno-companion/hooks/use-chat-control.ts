import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '@/constants/config';

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

type ServerEvent =
  | {
      type: 'chat.sync';
      sessionId: string;
      messages: unknown[];
    }
  | {
      type: 'chat.message';
      sessionId: string;
      message: unknown;
    }
  | {
      type: 'control.activeLine';
      sessionId: string;
      activeLine: ActiveLineLease | null;
    };

const buildWebsocketUrl = (sessionId: string, participantId: string, name: string, role: string) => {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  const url = new URL('/api/chat', wsBase);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('participantId', participantId);
  url.searchParams.set('name', name);
  url.searchParams.set('role', role);
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

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as ServerEvent;
            if (payload.type === 'control.activeLine') {
              setActiveLine(payload.activeLine ?? null);
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



