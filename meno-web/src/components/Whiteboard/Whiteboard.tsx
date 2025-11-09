"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { useSharedCanvas } from "@/lib/canvas/useSharedCanvas";
import type { CanvasPoint } from "@/lib/canvas/types";
import { usePresenceStore } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";
import { useYjs } from "@/lib/whiteboard/provider";
import { chatClient } from "@/lib/chat/client";
import {
  fetchLease,
  releaseLease as releaseLeaseApi,
  submitLine,
  takeLease as takeLeaseApi,
} from "@/lib/api/lease";

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
  const activeLine = useSessionStore((state) => state.activeLine);
  const setActiveLineState = useSessionStore((state) => state.setActiveLine);
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

  const leaseHolderName = useMemo(() => {
    if (!activeLine?.leaseTo) return null;
    if (activeLine.leaseTo === localParticipantId) {
      return localDisplayName;
    }
    const match = sessionParticipants.find((participant) => participant.id === activeLine.leaseTo);
    return match?.name ?? "Participant";
  }, [activeLine?.leaseTo, localParticipantId, localDisplayName, sessionParticipants]);

  const leaseColor = useMemo(() => {
    if (!activeLine?.leaseTo) return "var(--muted)";
    if (activeLine.leaseTo === localParticipantId) return localColor;
    const record = presenceParticipants.find((participant) => participant.participantId === activeLine.leaseTo);
    return record?.color ?? "var(--muted)";
  }, [activeLine?.leaseTo, localParticipantId, localColor, presenceParticipants]);

  const [leaseCountdown, setLeaseCountdown] = useState<number>(0);

  const canDraw = !activeLine?.leaseTo || activeLine.leaseTo === localParticipantId;
  const drawDisabledReason = !canDraw
    ? leaseHolderName
      ? `Waiting for ${leaseHolderName} to finish…${leaseCountdown > 0 ? ` (${leaseCountdown}s)` : ""}`
      : "Waiting for control to be granted."
    : undefined;

  useEffect(() => {
    if (!activeLine) {
      setLeaseCountdown(0);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((activeLine.leaseExpiresAt - Date.now()) / 1000));
      setLeaseCountdown(remaining);
      if (remaining <= 0) {
        setActiveLineState(null);
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [activeLine?.leaseId, activeLine?.leaseExpiresAt, setActiveLineState]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTakeControl = useCallback(async () => {
    if (!sessionId || !localParticipantId) return;
    const targetStep = typeof activeLine?.stepIndex === "number" ? activeLine.stepIndex : 0;
    try {
      const response = await takeLeaseApi(sessionId, {
        stepIndex: targetStep,
        leaseTo: localParticipantId,
      });
      if (response.ok) {
        setActiveLineState(response.data);
      } else {
        showToast({
          variant: "error",
          title: "Unable to take control",
          description: response.error,
        });
      }
    } catch (error) {
      console.error("Take control failed", error);
      showToast({
        variant: "error",
        title: "Unable to take control",
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  }, [activeLine?.stepIndex, localParticipantId, sessionId, setActiveLineState]);

  const handleReleaseControl = useCallback(async () => {
    if (!sessionId || activeLine?.leaseTo !== localParticipantId) return;
    try {
      const response = await releaseLeaseApi(sessionId);
      if (response.ok) {
        setActiveLineState(response.data);
      } else {
        showToast({
          variant: "error",
          title: "Unable to release control",
          description: response.error,
        });
      }
    } catch (error) {
      console.error("Release control failed", error);
      showToast({
        variant: "error",
        title: "Unable to release control",
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  }, [activeLine?.leaseTo, localParticipantId, sessionId, setActiveLineState]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchLease(sessionId);
        if (!payload?.ok || cancelled) return;
        setActiveLineState(payload.data);
      } catch (error) {
        console.warn("Failed to hydrate lease state", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setActiveLineState]);

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

  const handleSubmitStep = useCallback(async () => {
    if (!sessionId || !localParticipantId || !strokes.length) return;
    const stepIndex = activeLine?.stepIndex ?? 0;
    setIsSubmitting(true);
    try {
      let snapshot: string | null = null;
      const bandCanvas = canvasRef.current?.captureActiveBand();
      if (bandCanvas) {
        snapshot = bandCanvas.toDataURL("image/png");
      }

      const response = await submitLine(sessionId, stepIndex, {
        strokes,
        leaseTo: localParticipantId,
        submitter: {
          participantId: localParticipantId,
          name: localDisplayName,
          role: "teacher",
        },
        snapshot,
      });
      if (!response.ok) {
        showToast({
          variant: "error",
          title: "Submission failed",
          description: response.error,
        });
        return;
      }
      const { nextActiveLine } = response.data;
      setActiveLineState({
        leaseId: crypto.randomUUID?.() ?? `lease-${Date.now()}`,
        stepIndex: nextActiveLine.stepIndex,
        leaseTo: nextActiveLine.leaseTo,
        leaseIssuedAt: new Date().toISOString(),
        leaseExpiresAt: Date.now() + 30_000,
      });
      showToast({
        variant: "success",
        title: "Step accepted",
        description: "Nice work. Move on to the next line.",
      });
    } catch (error) {
      console.error("Submit line failed", error);
      showToast({
        variant: "error",
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeLine?.stepIndex,
    clearInternal,
    localDisplayName,
    localParticipantId,
    setActiveLineState,
    sessionId,
    strokes,
  ]);

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
    if (!canDraw) return;
    clearInternal();
  }, [canDraw, clearInternal]);

  const handleEraseLast = useCallback(() => {
    if (!canDraw) return;
    const last = strokes.at(-1);
    if (last) {
      eraseStrokeInternal(last.id);
    }
  }, [canDraw, eraseStrokeInternal, strokes]);

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
    <div className={cn("pointer-events-auto relative h-full w-full bg-[var(--paper)]", className)}>
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
        activeStepIndex={activeLine?.stepIndex ?? 0}
        canDraw={canDraw}
        disabledReason={drawDisabledReason}
      />
      {sessionId && localParticipantId ? (
        <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+1.75rem)] right-[max(1.5rem,env(safe-area-inset-right)+1rem)] flex flex-col items-end gap-3">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)]/95 px-4 py-2 text-xs text-[var(--muted)] shadow-soft">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border border-white/70"
                style={{ backgroundColor: leaseHolderName ? leaseColor : "var(--border)" }}
              />
              {activeLine && activeLine.leaseTo && leaseCountdown > 0 ? (
                activeLine.leaseTo === localParticipantId ? (
                  <>
                    <span>You control this step</span>
                    <span aria-label="Lease countdown" className="font-semibold text-[var(--ink)]">
                      {leaseCountdown}s
                    </span>
                  </>
                ) : (
                  <>
                    <span>{leaseHolderName} guiding</span>
                    <span aria-label="Lease countdown" className="font-semibold text-[var(--ink)]">
                      {leaseCountdown}s
                    </span>
                  </>
                )
              ) : (
                <span>Line available</span>
              )}
            </span>
            {activeLine && activeLine.leaseTo === localParticipantId ? (
              <Button variant="ghost" size="sm" onClick={handleReleaseControl} disabled={activeLine.leaseTo !== localParticipantId}>
                Release
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleTakeControl}
                disabled={!localParticipantId || activeLine?.leaseTo === localParticipantId}
              >
                Take Control
              </Button>
            )}
          </div>
          <Button
            variant="success"
            size="lg"
            className="pointer-events-auto rounded-full px-6"
            onClick={handleSubmitStep}
            disabled={!canDraw || !strokes.length || isSubmitting}
          >
            {isSubmitting ? "Submitting…" : "Submit Line"}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

