"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/components/ui/cn";

import {
  Tldraw,
  type TLUiOverrides,
} from "@tldraw/tldraw";

import "@tldraw/tldraw/tldraw.css";

import { usePresenceStore } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";
import { useYjs } from "@/lib/whiteboard/provider";

type WhiteboardProps = {
  className?: string;
};

export function Whiteboard({ className }: WhiteboardProps) {
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

  useEffect(() => {
    const editor = editorRef.current;
    const connection = yjsConnection;

    if (!editor || !connection) {
      return () => {
        /* noop */
      };
    }

    const { doc, provider } = connection;
    const storeMap = doc.getMap("tldraw");

    let isApplyingRemote = false;
    let isPushingDoc = false;
    let lastSerialized = (storeMap.get("snapshot") as string | undefined) ?? "";

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

    const pushSnapshotToDoc = () => {
      if (!editor) {
        return;
      }
      const snapshot = editor.store.getStoreSnapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSerialized) {
        return;
      }
      isPushingDoc = true;
      doc.transact(() => {
        storeMap.set("snapshot", serialized);
        storeMap.set("updatedAt", Date.now());
      });
      lastSerialized = serialized;
      isPushingDoc = false;
      saveLocalSnapshot(serialized);
    };

    const applyRemoteSnapshot = (rawValue?: string) => {
      const raw = rawValue ?? (storeMap.get("snapshot") as string | undefined) ?? "";
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
      } catch (error) {
        console.error("Failed to apply remote whiteboard snapshot", error);
      } finally {
        isApplyingRemote = false;
      }
    };

    const handleMapUpdate = () => {
      if (isApplyingRemote || isPushingDoc) {
        return;
      }
      applyRemoteSnapshot();
    };

    const handleStatusChange = (event: { status: "connected" | "disconnected" }) => {
      if (event.status === "connected" && editor) {
        const local = loadLocalSnapshot();
        const current = (storeMap.get("snapshot") as string | undefined) ?? "";
        if (local && local !== current) {
          applyRemoteSnapshot(local);
        } else {
          pushSnapshotToDoc();
        }
      }
    };

    storeMap.observe(handleMapUpdate);
    provider.on("status", handleStatusChange);

    const existingDoc = (storeMap.get("snapshot") as string | undefined) ?? null;
    const localSnapshot = existingDoc ?? loadLocalSnapshot();

    if (localSnapshot) {
      applyRemoteSnapshot(localSnapshot);
    } else {
      pushSnapshotToDoc();
    }

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
      storeMap.unobserve(handleMapUpdate);
      provider.off("status", handleStatusChange);
      unsubscribe();
    };
  }, [localStorageKey, yjsConnection]);

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
}
