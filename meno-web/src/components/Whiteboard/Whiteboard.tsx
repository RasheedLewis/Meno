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

    const { doc } = connection;
    const text = doc.getText("tldraw");

    let isApplyingRemote = false;
    let isPushingDoc = false;

    const pushSnapshotToDoc = () => {
      if (!editor) return;
      const snapshot = editor.store.getStoreSnapshot();
      const serialized = JSON.stringify(snapshot);
      isPushingDoc = true;
      doc.transact(() => {
        text.delete(0, text.length);
        text.insert(0, serialized);
      });
      isPushingDoc = false;
    };

    const applyRemoteSnapshot = () => {
      const raw = text.toString();
      if (!raw) {
        return;
      }
      try {
        const snapshot = JSON.parse(raw);
        isApplyingRemote = true;
        editor.store.mergeRemoteChanges(() => {
          editor.store.loadStoreSnapshot(snapshot);
        });
      } catch (error) {
        console.error("Failed to apply remote whiteboard snapshot", error);
      } finally {
        isApplyingRemote = false;
      }
    };

    const handleTextUpdate = () => {
      if (isApplyingRemote || isPushingDoc) {
        return;
      }
      applyRemoteSnapshot();
    };

    text.observe(handleTextUpdate);

    if (text.length === 0) {
      pushSnapshotToDoc();
    } else {
      applyRemoteSnapshot();
    }

    const unsubscribe = editor.store.listen(
      (entry) => {
        if (isApplyingRemote) {
          return;
        }
        if (entry.source === "remote") {
          return;
        }
        pushSnapshotToDoc();
      },
      { scope: "document", source: "all" },
    );

    return () => {
      text.unobserve(handleTextUpdate);
      unsubscribe();
    };
  }, [yjsConnection]);

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
