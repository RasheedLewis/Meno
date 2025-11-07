import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromUint8Array, toUint8Array } from 'js-base64';

import { YWS_BASE_URL } from '@/constants/config';
import { ensureSessionDoc } from '@/lib/sessionDoc';

type Doc = import('yjs').Doc;
type WebsocketProvider = import('y-websocket').WebsocketProvider;
type Awareness = import('y-protocols/awareness').Awareness;

export interface YjsSessionConnection {
  doc: Doc;
  provider: WebsocketProvider;
  awareness: Awareness;
}

const storageKeyFor = (sessionId: string) => `meno-companion-session-${sessionId}`;

export function useSessionYjs(sessionId: string | null, role: 'companion' | 'host' | 'teacher') {
  const [connection, setConnection] = useState<YjsSessionConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: Doc | null = null;
    let provider: WebsocketProvider | null = null;
    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    let yModule: typeof import('yjs') | null = null;

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

        ensureSessionDoc(doc);

        doc.on('update', schedulePersist);

        provider = new WebsocketProvider(YWS_BASE_URL, sessionId, doc, {
          connect: true,
        });

        provider.awareness.setLocalState({
          role,
          client: 'tablet',
          updatedAt: Date.now(),
        });

        if (!cancelled) {
          setConnection({ doc, provider, awareness: provider.awareness });
          void persistState();
        }
      } catch (error) {
        console.error('Failed to initialise companion Yjs connection', error);
        if (!cancelled) {
          setConnection(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      setConnection(null);
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      if (doc) {
        doc.off('update', schedulePersist);
      }
      if (provider) {
        provider.destroy();
      }
      if (doc) {
        doc.destroy();
      }
    };
  }, [sessionId, role]);

  return connection;
}


