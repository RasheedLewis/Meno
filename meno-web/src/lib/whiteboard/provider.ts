import { useEffect, useState } from "react";

import { getYjsWebsocketBaseUrl } from "@/lib/whiteboard/config";
import { ensureSessionDoc, getStrokesArray } from "@/lib/whiteboard/sessionDoc";

type Doc = import("yjs").Doc;
type WebsocketProvider = import("y-websocket").WebsocketProvider;
type Awareness = import("y-protocols/awareness").Awareness;
type IndexeddbPersistence = {
  destroy?: () => void;
  whenSynced?: Promise<unknown>;
};

export interface YjsConnection {
  doc: Doc;
  provider: WebsocketProvider;
  awareness: Awareness;
}

export function useYjs(roomId: string | null): YjsConnection | null {
  const [connection, setConnection] = useState<YjsConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: Doc | null = null;
    let provider: WebsocketProvider | null = null;
    let persistence: IndexeddbPersistence | null = null;

    if (!roomId) {
      setConnection(null);
      return () => {
        /* noop */
      };
    }

    (async () => {
      try {
        const [{ Doc }, { WebsocketProvider }] = await Promise.all([import("yjs"), import("y-websocket")]);
        let IndexeddbPersistenceModule: typeof import("y-indexeddb") | null = null;

        try {
          IndexeddbPersistenceModule = await import("y-indexeddb");
        } catch (error) {
          console.warn("IndexedDB persistence unavailable; continuing without it.", error);
        }

        if (cancelled) {
          return;
        }

        const serverUrl = getYjsWebsocketBaseUrl();

        doc = new Doc();

        const session = ensureSessionDoc(doc);
        const strokesArray = getStrokesArray(session);
        strokesArray.toArray();

        if (IndexeddbPersistenceModule) {
          persistence = new IndexeddbPersistenceModule.IndexeddbPersistence(`meno-session-${roomId}`, doc);
        }

        provider = new WebsocketProvider(serverUrl, roomId, doc, {
          connect: true,
        });

        const connectionValue: YjsConnection = {
          doc,
          provider,
          awareness: provider.awareness,
        };

        if (persistence?.whenSynced) {
          try {
            await persistence.whenSynced;
          } catch (error) {
            console.warn("IndexedDB sync failed", error);
          }
        }

        if (!cancelled) {
          setConnection(connectionValue);
        }
      } catch (error) {
        console.error("Failed to initialize Yjs connection", error);
        if (!cancelled) {
          setConnection(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      setConnection(null);
      if (doc) {
        doc.destroy();
      }
      if (persistence?.destroy) {
        persistence.destroy();
      }
      if (provider) {
        provider.destroy();
      }
    };
  }, [roomId]);

  return connection;
}

