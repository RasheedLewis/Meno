"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import { cn } from "@/components/ui/cn";
import { showToast } from "@/components/ui/Toast";
import { useSharedCanvas } from "@/lib/canvas/useSharedCanvas";
import type { CanvasPoint } from "@/lib/canvas/types";
import { usePresenceStore } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";
import { useYjs } from "@/lib/whiteboard/provider";

import SharedCanvas, { type SharedCanvasHandle } from "./SharedCanvas";

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
  const presenceParticipants = usePresenceStore((state) => state.participants);
  const localParticipantId = useSessionStore((state) => state.participantId);
  const participantName = useSessionStore((state) => state.participantName);
  const sessionParticipants = useSessionStore((state) => state.participants);
  const sessionId = useSessionStore((state) => state.sessionId);

  const localColor = useMemo(() => {
    const record = presenceParticipants.find((participant) => participant.participantId === localParticipantId);
    return record?.color ?? "#2B8A9C";
  }, [localParticipantId, presenceParticipants]);

  const localDisplayName = useMemo(() => {
    if (participantName?.trim()) {
      return participantName;
    }
    const match = sessionParticipants.find((participant) => participant.id === localParticipantId);
    return match?.name ?? "You";
  }, [participantName, sessionParticipants, localParticipantId]);

  const yjsConnection = useYjs(sessionId);
  const {
    strokes,
    beginStroke: beginStrokeInternal,
    appendToStroke: appendToStrokeInternal,
    endStroke: endStrokeInternal,
    cancelStroke: cancelStrokeInternal,
    clear: clearInternal,
    eraseStroke: eraseStrokeInternal,
    awareness,
    doc,
  } = useSharedCanvas(yjsConnection);

  const canvasRef = useRef<SharedCanvasHandle | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);

  const storageKey = typeof window === "undefined" || !sessionId ? null : `meno-whiteboard-state-${sessionId}`;

  const beginStroke = useCallback(
    (point: CanvasPoint, size: number) =>
      beginStrokeInternal({
        color: localColor,
        size,
        author: localParticipantId ?? null,
        start: point,
      }),
    [beginStrokeInternal, localColor, localParticipantId],
  );

  const appendToStroke = useCallback(
    (strokeId: string, points: CanvasPoint[]) => appendToStrokeInternal(strokeId, points),
    [appendToStrokeInternal],
  );

  const endStroke = useCallback(
    (strokeId: string) => endStrokeInternal(strokeId),
    [endStrokeInternal],
  );

  const cancelStroke = useCallback(
    (strokeId: string) => cancelStrokeInternal(strokeId),
    [cancelStrokeInternal],
  );

  const handleClear = useCallback(() => {
    clearInternal();
  }, [clearInternal]);

  const handleEraseLast = useCallback(() => {
    const last = strokes.at(-1);
    if (last) {
      eraseStrokeInternal(last.id);
    }
  }, [eraseStrokeInternal, strokes]);

  const updatePointer = useCallback(
    (pointer: CanvasPoint | null) => {
      if (!awareness) return;
      const current = awareness.getLocalState() ?? {};
      awareness.setLocalState({
        ...current,
        pointer,
        color: localColor,
        participantId: localParticipantId ?? undefined,
        displayName: localDisplayName,
        role: "host",
        client: "web",
        updatedAt: Date.now(),
      });
    },
    [awareness, localColor, localParticipantId, localDisplayName],
  );

  useEffect(() => {
    if (!awareness) return;
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({
      ...current,
      pointer: null,
      color: localColor,
      participantId: localParticipantId ?? undefined,
      displayName: localDisplayName,
      role: "host",
      client: "web",
      updatedAt: Date.now(),
    });
  }, [awareness, localColor, localParticipantId, localDisplayName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!doc || !sessionId) return;

    const applySnapshot = (encoded: string | null | undefined) => {
      if (!encoded || encoded === lastSnapshotRef.current) return;
      try {
        const update = toUint8Array(encoded);
        Y.applyUpdate(doc, update);
        lastSnapshotRef.current = encoded;
        if (storageKey) {
          window.localStorage.setItem(storageKey, encoded);
        }
      } catch (error) {
        console.warn("Failed to apply whiteboard snapshot", error);
      }
    };

    if (storageKey) {
      try {
        const cached = window.localStorage.getItem(storageKey);
        applySnapshot(cached);
      } catch (error) {
        console.warn("Failed to read cached whiteboard snapshot", error);
      }
    }

    void (async () => {
      try {
        const response = await fetch(`/api/whiteboard/${sessionId}`);
        if (!response.ok) return;
        const payload = (await response.json()) as
          | { ok: true; data: { snapshot: string | null } | null }
          | { ok: false; error: string };
        if (payload?.ok) {
          applySnapshot(payload.data?.snapshot ?? null);
        }
      } catch (error) {
        console.warn("Failed to fetch whiteboard snapshot", error);
      }
    })();

    const persistDoc = () => {
      if (persistTimerRef.current) return;
      persistTimerRef.current = window.setTimeout(async () => {
        persistTimerRef.current = null;
        try {
          const update = Y.encodeStateAsUpdate(doc);
          const encoded = fromUint8Array(update, true);
          lastSnapshotRef.current = encoded;
          if (storageKey) {
            window.localStorage.setItem(storageKey, encoded);
          }
          await fetch(`/api/whiteboard/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              snapshot: encoded,
              updatedAt: new Date().toISOString(),
            }),
          });
        } catch (error) {
          console.warn("Failed to persist whiteboard snapshot", error);
        }
      }, 800);
    };

    const handleUpdate = () => {
      persistDoc();
    };

    doc.on("update", handleUpdate);

    return () => {
      doc.off("update", handleUpdate);
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [doc, sessionId, storageKey]);

  const exportAsPng = useCallback(async () => {
    const canvasElement = canvasRef.current?.getCanvas();
    if (!canvasElement) {
      const message = "Whiteboard is still initializing.";
      showToast({ variant: "error", title: "Export failed", description: message });
      throw new Error(message);
    }

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasElement.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Unable to render canvas"));
        }, "image/png");
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

  return (
    <div className={cn("pointer-events-auto h-full w-full bg-[var(--paper)]", className)}>
      <SharedCanvas
        ref={canvasRef}
        strokes={strokes}
        beginStroke={beginStroke}
        appendToStroke={appendToStroke}
        endStroke={endStroke}
        cancelStroke={cancelStroke}
        onClear={handleClear}
        onEraseLast={handleEraseLast}
        pointerColor={localColor}
        awareness={awareness}
        localParticipantId={localParticipantId}
      localDisplayName={localDisplayName}
        onPointerUpdate={updatePointer}
      />
    </div>
  );
});

