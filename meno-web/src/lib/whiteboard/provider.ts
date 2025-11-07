import { useEffect, useState } from "react";

import { getYjsWebsocketUrl } from "@/lib/whiteboard/config";

type Doc = import("yjs").Doc;
type WebsocketProvider = import("y-websocket").WebsocketProvider;

export interface YjsConnection {
  doc: Doc;
  provider: WebsocketProvider;
}

export function useYjs(roomId: string | null): YjsConnection | null {
  const [connection, setConnection] = useState<YjsConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: Doc | null = null;
    let provider: WebsocketProvider | null = null;

    if (!roomId) {
      setConnection(null);
      return () => {
        /* noop */
      };
    }

    (async () => {
      try {
        const [{ Doc }, { WebsocketProvider }] = await Promise.all([
          import("yjs"),
          import("y-websocket"),
        ]);

        if (cancelled) {
          return;
        }

        doc = new Doc();
        provider = new WebsocketProvider(getYjsWebsocketUrl(), roomId, doc, {
          connect: true,
        });

        setConnection({ doc, provider });
      } catch (error) {
        console.error("Failed to initialize Yjs connection", error);
        setConnection(null);
      }
    })();

    return () => {
      cancelled = true;
      setConnection(null);
      if (provider) {
        provider.destroy();
      }
      if (doc) {
        doc.destroy();
      }
    };
  }, [roomId]);

  return connection;
}

