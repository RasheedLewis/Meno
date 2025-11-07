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

type WhiteboardProps = {
  className?: string;
};

export function Whiteboard({ className }: WhiteboardProps) {
  const editorRef = useRef<import("@tldraw/tldraw").Editor | null>(null);

  const presenceParticipants = usePresenceStore((state) => state.participants);
  const localParticipantId = useSessionStore((state) => state.participantId);

  const localColor = useMemo(() => {
    const record = presenceParticipants.find((participant) => participant.participantId === localParticipantId);
    return record?.color ?? "#8B5E3C";
  }, [localParticipantId, presenceParticipants]);

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
