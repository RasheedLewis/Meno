import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromUint8Array, toUint8Array } from 'js-base64';

import { YWS_BASE_URL } from '@/constants/config';
import { ensureSessionDoc, getStrokesArray } from '@/lib/sessionDoc';

type Doc = import('yjs').Doc;
type WebsocketProvider = import('y-websocket').WebsocketProvider;
type Awareness = import('y-protocols/awareness').Awareness;

export interface YjsSessionConnection {
  doc: Doc;
  provider: WebsocketProvider;
  awareness: Awareness;
}

const storageKeyFor = (sessionId: string) => `meno-companion-session-${sessionId}`;

interface SessionOptions {
  color?: string;
  participantId?: string;
}

export function useSessionYjs(
  sessionId: string | null,
  role: 'companion' | 'host' | 'teacher',
  options: SessionOptions = {},
) {
  const [connection, setConnection] = useState<YjsSessionConnection | null>(null);
  const stateRef = useRef<YjsSessionConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: Doc | null = null;
    let provider: WebsocketProvider | null = null;
    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    let yModule: typeof import('yjs') | null = null;
    let docUpdateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;

    if (!sessionId) {
      setConnection(null);
      return () => {
        /* noop */
      };
    }

    const persistState = async () => {
      if (!doc) return;
      try {
        if (!yModule) {
          yModule = await import('yjs');
        }
        const encoded = fromUint8Array(yModule.encodeStateAsUpdate(doc));
        await AsyncStorage.setItem(storageKeyFor(sessionId), encoded);
      } catch (error) {
        console.warn('Failed to persist Yjs session state', error);
      }
    };

    const schedulePersist = () => {
      if (persistTimer) return;
      persistTimer = setTimeout(() => {
        persistTimer = null;
        void persistState();
      }, 500);
    };

    (async () => {
      try {
        const [Y, { WebsocketProvider }] = await Promise.all([import('yjs'), import('y-websocket')]);
        yModule = Y;

        if (cancelled) {
          return;
        }

        doc = new Y.Doc();

        const stored = await AsyncStorage.getItem(storageKeyFor(sessionId));
        if (stored) {
          try {
            const update = toUint8Array(stored);
            Y.applyUpdate(doc, update);
          } catch (error) {
            console.warn('Failed to apply stored Yjs snapshot', error);
          }
        }

        const session = ensureSessionDoc(doc);
        const strokesArray = getStrokesArray(session);
        strokesArray.toArray();

        docUpdateHandler = (update: Uint8Array, origin: unknown) => {
          console.log('[Companion Yjs] doc update', { length: update.length, origin });
          schedulePersist();
        };

        doc.on('update', docUpdateHandler);

        provider = new WebsocketProvider(YWS_BASE_URL, sessionId, doc, {
          connect: true,
        });

        provider.on('status', (event: { status: 'connected' | 'disconnected' }) => {
          console.log('[Companion Yjs] status', event.status);
        });

        provider.on('sync', (isSynced: boolean) => {
          console.log('[Companion Yjs] sync', isSynced);
        });

        provider.awareness.setLocalState({
          role,
          client: 'tablet',
          color: options.color ?? '#F97316',
          participantId: options.participantId ?? role,
          updatedAt: Date.now(),
          pointer: null,
        });

        if (!cancelled) {
          const nextConnection: YjsSessionConnection = {
            doc,
            provider,
            awareness: provider.awareness,
          };
          stateRef.current = nextConnection;
          setConnection(nextConnection);
          void persistState();
        }
      } catch (error) {
        console.error('Failed to initialise companion Yjs connection', error);
        if (!cancelled) {
          setConnection(null);
          stateRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      setConnection(null);
      stateRef.current = null;
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      if (doc && docUpdateHandler) {
        doc.off('update', docUpdateHandler);
      }
      if (provider) {
        try {
          provider.destroy();
        } catch (error) {
          console.warn('Failed to destroy Yjs provider', error);
        }
      }
      if (doc) {
        doc.destroy();
      }
    };
  }, [sessionId, role]);

  useEffect(() => {
    const latest = stateRef.current ?? connection;
    if (!latest?.provider) return;
    const { awareness } = latest.provider;
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({
      ...current,
      role,
      client: 'tablet',
      color: options.color ?? current.color ?? '#F97316',
      participantId: options.participantId ?? current.participantId ?? role,
      updatedAt: Date.now(),
    });
  }, [connection, options.color, options.participantId, role]);

  return connection;
}


