import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Awareness } from "y-protocols/awareness";

import type { CanvasPoint, SharedStroke } from "@/lib/canvas/types";

interface PointerState {
  id: number;
  participantId?: string;
  displayName?: string;
  role?: string;
  color?: string;
  point?: CanvasPoint | null;
}

export interface SharedCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

interface SharedCanvasProps {
  strokes: SharedStroke[];
  beginStroke: (point: CanvasPoint, width: number) => string | null;
  appendToStroke: (strokeId: string, points: CanvasPoint[]) => void;
  endStroke: (strokeId: string) => void;
  cancelStroke: (strokeId: string) => void;
  onClear: () => void;
  onEraseLast: () => void;
  pointerColor: string;
  awareness: Awareness | null;
  localParticipantId?: string | null;
  localDisplayName?: string;
  onPointerUpdate: (point: CanvasPoint | null) => void;
}

const CANVAS_BACKGROUND = "#FFFFFF";

const SharedCanvas = forwardRef<SharedCanvasHandle, SharedCanvasProps>(function SharedCanvas(
  {
    strokes,
    beginStroke,
    appendToStroke,
    endStroke,
    cancelStroke,
    onClear,
    onEraseLast,
    pointerColor,
    awareness,
    localParticipantId,
    localDisplayName,
    onPointerUpdate,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 1, height: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeId = useRef<string | null>(null);

  const [remotePointers, setRemotePointers] = useState<PointerState[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      getCanvas: () => canvasRef.current,
    }),
    [],
  );

  // Awareness listeners
  useEffect(() => {
    if (!awareness) {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) {
          setRemotePointers([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    const updatePointers = () => {
      const entries = Array.from(awareness.getStates().entries()).map(([id, state]) => ({
        id,
        participantId: (state as PointerState & { participantId?: string }).participantId,
        displayName: (state as PointerState & { displayName?: string }).displayName,
        role: (state as PointerState & { role?: string }).role,
        color: (state as PointerState & { color?: string }).color,
        point: (state as PointerState & { pointer?: CanvasPoint }).pointer ?? null,
      }));

      const filtered = entries.filter((entry) => entry.id !== awareness.clientID);
      Promise.resolve().then(() => {
        if (!cancelled) {
          setRemotePointers(filtered);
        }
      });
    };

    updatePointers();
    awareness.on("change", updatePointers);

    return () => {
      cancelled = true;
      awareness.off("change", updatePointers);
    };
  }, [awareness]);

  // Resize observer to match canvas size
  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.max(width, 1), height: Math.max(height, 1) });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Sync canvas resolution with container size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    const context = canvas.getContext("2d");
    context?.scale(dpr, dpr);
  }, [size]);

  const drawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.save();
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = CANVAS_BACKGROUND;
    context.fillRect(0, 0, size.width, size.height);

    const baseDimension = Math.min(size.width, size.height);

    for (const stroke of strokes) {
      const points = stroke.points;
      if (points.length === 0) {
        continue;
      }

      context.beginPath();
      const start = points[0];
      context.moveTo(start.x * size.width, start.y * size.height);
      for (let i = 1; i < points.length; i += 1) {
        const point = points[i];
        context.lineTo(point.x * size.width, point.y * size.height);
      }
      context.strokeStyle = stroke.color;
      context.lineWidth = Math.max(stroke.size * baseDimension, 1.5);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
    }

    context.restore();
  }, [size.height, size.width, strokes]);

  useEffect(() => {
    drawStrokes();
  }, [drawStrokes]);

  const getNormalizedPoint = useCallback(
    (event: PointerEvent): CanvasPoint => {
      const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      return {
        x: Math.min(Math.max(x, 0), 1),
        y: Math.min(Math.max(y, 0), 1),
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      const point = getNormalizedPoint(event);
      onPointerUpdate(point);
      const baseDimension = Math.min(rect.width, rect.height);
      const strokeWidth = 5 / baseDimension;
      const id = beginStroke(point, strokeWidth);
      if (id) {
        currentStrokeId.current = id;
        setIsDrawing(true);
      }
    },
    [beginStroke, getNormalizedPoint, onPointerUpdate],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const point = getNormalizedPoint(event);
      onPointerUpdate(point);
      if (!isDrawing || !currentStrokeId.current) {
        return;
      }
      event.preventDefault();
      appendToStroke(currentStrokeId.current, [point]);
    },
    [appendToStroke, getNormalizedPoint, isDrawing, onPointerUpdate],
  );

  const finishStroke = useCallback(
    (cancel = false) => {
      const strokeId = currentStrokeId.current;
      if (!strokeId) return;
      if (cancel) {
        cancelStroke(strokeId);
      } else {
        endStroke(strokeId);
      }
      currentStrokeId.current = null;
      setIsDrawing(false);
      onPointerUpdate(null);
    },
    [cancelStroke, endStroke, onPointerUpdate],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      finishStroke(false);
    },
    [finishStroke],
  );

  const handlePointerLeave = useCallback(() => {
    if (isDrawing) {
      finishStroke(false);
    } else {
      onPointerUpdate(null);
    }
  }, [finishStroke, isDrawing, onPointerUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", () => finishStroke(true));
    canvas.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", () => finishStroke(true));
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [finishStroke, handlePointerDown, handlePointerLeave, handlePointerMove, handlePointerUp]);

  const baseDimension = useMemo(() => Math.min(size.width, size.height), [size.height, size.width]);

  const remoteCursorElements = remotePointers
    .filter((pointer) => pointer.point)
    .map((pointer) => {
      const point = pointer.point!;
      const x = point.x * size.width;
      const y = point.y * size.height;
      return (
        <div
          key={pointer.id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          style={{ left: x, top: y }}
        >
          {pointer.displayName ?? pointer.participantId ? (
            <span
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{
                backgroundColor: pointer.color ?? "#4F46E5",
              }}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full border border-white/60" />
              {pointer.displayName ?? pointer.participantId}
            </span>
          ) : null}
        </div>
      );
    });

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair rounded-3xl border border-[var(--border)] bg-[var(--paper)] shadow-inner"
      />
      {remoteCursorElements}

      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-3">
        <button
          type="button"
          className="pointer-events-auto rounded-full border border-[var(--border)] bg-[var(--paper)]/95 px-4 py-1.5 text-sm font-medium text-[var(--muted)] shadow-sm transition hover:bg-[var(--paper)]"
          onClick={onEraseLast}
        >
          Undo
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded-full border border-[var(--border)] bg-[var(--paper)]/95 px-4 py-1.5 text-sm font-medium text-[var(--muted)] shadow-sm transition hover:bg-[var(--paper)]"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <div
        className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/50 bg-[var(--paper)]/85 px-3 py-1 text-xs text-[var(--muted)] shadow-sm backdrop-blur"
        style={{ color: pointerColor }}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-white/70 shadow"
          style={{ backgroundColor: pointerColor }}
        />
        {localDisplayName ?? localParticipantId ?? "You"}
      </div>
      <div
        className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/50 bg-[var(--paper)]/85 px-3 py-1 text-xs text-[var(--muted)] shadow-sm backdrop-blur"
        style={{ color: pointerColor }}
      >
        Brush ~{Math.round(Math.max(baseDimension * 0.015, 5))} px
      </div>
    </div>
  );
});

export default SharedCanvas;


