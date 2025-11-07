"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { cn } from "@/components/ui/cn";
import { showToast } from "@/components/ui/Toast";

import * as Y from "yjs";

import {
  Tldraw,
  type TLUiOverrides,
  exportToBlob,
} from "@tldraw/tldraw";

import "@tldraw/tldraw/tldraw.css";

import { usePresenceStore } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";
import { useYjs } from "@/lib/whiteboard/provider";
import { ensureSessionDoc } from "@/lib/whiteboard/sessionDoc";

type WhiteboardProps = {
  className?: string;
};

export interface WhiteboardHandle {
  exportAsPng: () => Promise<void>;
}

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(
  { className }: WhiteboardProps,
  ref,
) {
  const editorRef = useRef<import("@tldraw/tldraw").Editor | null>(null);

  const presenceParticipants = usePresenceStore((state) => state.participants);
  const localParticipantId = useSessionStore((state) => state.participantId);
  const sessionId = useSessionStore((state) => state.sessionId);

  const localColor = useMemo(() => {
    const record = presenceParticipants.find((participant) => participant.participantId === localParticipantId);
    return record?.color ?? "#8B5E3C";
  }, [localParticipantId, presenceParticipants]);

  const yjsConnection = useYjs(sessionId);
  const localStorageKey = sessionId ? `meno-whiteboard-${sessionId}` : null;
  const persistTimerRef = useRef<number | null>(null);
  const lastPersistedRef = useRef<string>("");

  const overrides = useMemo<TLUiOverrides>(
    () => ({
      toolbar: (editor, toolbar) => toolbar,
      stylePanel: () => null,
      helperButtons: () => null,
      contextMenu: () => null,
      quickActions: () => [],
      actionsMenu: () => [],
      helpMenu: () => [],
    }),
    [],
  );

  useEffect(() => {
    if (editorRef.current && localColor) {
      editorRef.current.user.updateUserPreferences({ color: localColor });
    }
  }, [localColor]);

  const exportAsPng = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      const message = "Whiteboard is still initializing.";
      showToast({ variant: "error", title: "Export failed", description: message });
      throw new Error(message);
    }

    try {
      const ids = Array.from(editor.getCurrentPageShapeIds());
      const blob = await exportToBlob({
        editor,
        ids,
        format: "png",
        opts: {
          background: editor.getInstanceState().exportBackground ?? true,
        },
      });

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .split("Z")[0];
      const filename = `meno-whiteboard-${sessionId ?? "session"}-${timestamp}.png`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast({
        variant: "success",
        title: "Exported PNG",
        description: "Download complete.",
      });
    } catch (error) {
      console.error("Whiteboard export failed", error);
      showToast({
        variant: "error",
        title: "Export failed",
        description: "Unable to save the whiteboard right now.",
      });
      throw error instanceof Error ? error : new Error("Export failed");
    }
  }, [sessionId]);

  useImperativeHandle(
    ref,
    () => ({
      exportAsPng,
    }),
    [exportAsPng],
  );

  useEffect(() => {
    if (!yjsConnection) return;
    const awareness = yjsConnection.awareness;
    const existing = awareness.getLocalState() ?? {};
    awareness.setLocalState({
      ...existing,
      role: "host",
      client: "web",
      participantId: localParticipantId ?? existing.participantId ?? "anonymous",
      color: localColor,
      updatedAt: Date.now(),
    });
  }, [yjsConnection, localParticipantId, localColor]);

  useEffect(() => {
    const editor = editorRef.current;
    const connection = yjsConnection;

    if (!editor || !connection) {
      return () => {
        /* noop */
      };
    }

    const { doc, provider } = connection;
    const { sessionMeta } = ensureSessionDoc(doc);

    let isApplyingRemote = false;
    let isPushingDoc = false;
    let lastSerialized = (sessionMeta.get("whiteboardSnapshot") as string | undefined) ?? "";
    let cancelled = false;

    const canUseStorage = typeof window !== "undefined" && Boolean(localStorageKey);

    const saveLocalSnapshot = (value: string) => {
      if (!canUseStorage || !localStorageKey) return;
      try {
        window.localStorage.setItem(localStorageKey, value);
      } catch (error) {
        console.warn("Failed to persist whiteboard snapshot locally", error);
      }
    };

    const loadLocalSnapshot = (): string | null => {
      if (!canUseStorage || !localStorageKey) return null;
      try {
        return window.localStorage.getItem(localStorageKey);
      } catch (error) {
        console.warn("Failed to read whiteboard snapshot from storage", error);
        return null;
      }
    };

    const schedulePersist = (value: string) => {
      if (!sessionId) return;
      if (lastPersistedRef.current === value) {
        return;
      }
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(async () => {
        if (cancelled) {
          return;
        }
        persistTimerRef.current = null;
        try {
          const response = await fetch(`/api/whiteboard/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot: value, updatedAt: new Date().toISOString() }),
          });
          if (!response.ok) {
            console.warn("Whiteboard snapshot persist failed", await response.text());
            return;
          }
          lastPersistedRef.current = value;
        } catch (error) {
          console.warn("Whiteboard snapshot persist error", error);
        }
      }, 800);
    };

    const setDocSnapshot = (value: string) => {
      if (value === lastSerialized) {
        return;
      }
      isPushingDoc = true;
      doc.transact(() => {
        sessionMeta.set("whiteboardSnapshot", value);
        sessionMeta.set("whiteboardUpdatedAt", Date.now());
      });
      lastSerialized = value;
      isPushingDoc = false;
    };

    const pushSnapshotToDoc = () => {
      if (!editor) {
        return;
      }
      const snapshot = editor.store.getStoreSnapshot();
      const serialized = JSON.stringify(snapshot);
      setDocSnapshot(serialized);
      saveLocalSnapshot(serialized);
      schedulePersist(serialized);
    };

    const applyRemoteSnapshot = (rawValue?: string, options?: { persist?: boolean }) => {
      const raw = rawValue ?? (sessionMeta.get("whiteboardSnapshot") as string | undefined) ?? "";
      if (!raw) {
        return;
      }
      try {
        const snapshot = JSON.parse(raw);
        isApplyingRemote = true;
        editor.store.mergeRemoteChanges(() => {
          editor.store.loadStoreSnapshot(snapshot);
        });
        lastSerialized = raw;
        saveLocalSnapshot(raw);
        if (options?.persist) {
          schedulePersist(raw);
        }
      } catch (error) {
        console.error("Failed to apply remote whiteboard snapshot", error);
      } finally {
        isApplyingRemote = false;
      }
    };

    const handleMapUpdate = (event: Y.YMapEvent<unknown>) => {
      if (!event.keysChanged.has("whiteboardSnapshot")) {
        return;
      }
      if (isApplyingRemote || isPushingDoc) {
        return;
      }
      applyRemoteSnapshot();
    };

    const handleStatusChange = (event: { status: "connected" | "disconnected" }) => {
      if (event.status === "connected" && editor) {
        const local = loadLocalSnapshot();
        const current = (sessionMeta.get("whiteboardSnapshot") as string | undefined) ?? "";
        if (local && local !== current) {
          applyRemoteSnapshot(local);
        } else {
          pushSnapshotToDoc();
        }
      }
    };

    sessionMeta.observe(handleMapUpdate);
    provider.on("status", handleStatusChange);

    const existingDoc = (sessionMeta.get("whiteboardSnapshot") as string | undefined) ?? null;
    const localSnapshot = loadLocalSnapshot();

    void (async () => {
      if (existingDoc) {
        if (cancelled) return;
        lastPersistedRef.current = existingDoc;
        applyRemoteSnapshot(existingDoc);
        return;
      }

      if (localSnapshot) {
        if (cancelled) return;
        setDocSnapshot(localSnapshot);
        applyRemoteSnapshot(localSnapshot, { persist: true });
        return;
      }

      if (sessionId) {
        try {
          const response = await fetch(`/api/whiteboard/${sessionId}`);
          if (response.ok) {
            const payload = (await response.json()) as
              | { ok: true; data: { snapshot: string; updatedAt: string } | null }
              | { ok: false; error: string };
            if (payload?.ok && payload.data?.snapshot) {
              if (cancelled) return;
              lastPersistedRef.current = payload.data.snapshot;
              setDocSnapshot(payload.data.snapshot);
              applyRemoteSnapshot(payload.data.snapshot);
              return;
            }
          }
        } catch (error) {
          console.warn("Failed to fetch whiteboard snapshot", error);
        }
      }

      pushSnapshotToDoc();
    })();

    const unsubscribe = editor.store.listen(
      (entry) => {
        if (isApplyingRemote || entry.source === "remote") {
          return;
        }
        pushSnapshotToDoc();
      },
      { scope: "document", source: "all" },
    );

    return () => {
      sessionMeta.unobserve(handleMapUpdate);
      provider.off("status", handleStatusChange);
      unsubscribe();
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      cancelled = true;
    };
  }, [localStorageKey, sessionId, yjsConnection]);

  return (
    <div className={cn("pointer-events-auto h-full w-full bg-[var(--paper)]", className)}>
      <Tldraw
        autoFocus
        inferDarkMode
        overrides={overrides}
        onMount={(editor) => {
          editorRef.current = editor;
          if (localColor) {
            editor.user.updateUserPreferences({ color: localColor });
          }
        }}
      />
    </div>
  );
});
