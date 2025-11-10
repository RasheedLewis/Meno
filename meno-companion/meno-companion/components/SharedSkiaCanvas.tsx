import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Awareness } from 'y-protocols/awareness';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import type { CanvasPoint, SharedStroke } from '@/hooks/use-shared-canvas';

interface PointerState {
  id: number;
  participantId?: string;
  displayName?: string;
  role?: string;
  color?: string;
  point?: CanvasPoint | null;
}

interface SharedSkiaCanvasProps {
  strokes: SharedStroke[];
  beginStroke: (point: CanvasPoint, size: number) => string | null;
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
  activeStepIndex?: number | null;
  canDraw?: boolean;
  disabledReason?: string;
}

const CANVAS_BACKGROUND = '#FFFFFF';

export default function SharedSkiaCanvas({
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
  activeStepIndex,
  canDraw = true,
  disabledReason,
}: SharedSkiaCanvasProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [remotePointers, setRemotePointers] = useState<PointerState[]>([]);
  const currentStrokeId = useRef<string | null>(null);

  React.useEffect(() => {
    if (!awareness) {
      setRemotePointers([]);
      return;
    }
    const update = () => {
      const entries = Array.from(awareness.getStates().entries()).map(([id, state]) => ({
        id,
        participantId: (state as PointerState & { participantId?: string }).participantId,
        displayName: (state as PointerState & { displayName?: string }).displayName,
        role: (state as PointerState & { role?: string }).role,
        color: (state as PointerState & { color?: string }).color,
        point: (state as PointerState & { pointer?: CanvasPoint }).pointer ?? null,
      }));
      setRemotePointers(entries.filter((entry) => entry.id !== awareness.clientID));
    };
    update();
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [awareness]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canDraw,
        onMoveShouldSetPanResponder: () => canDraw,
        onPanResponderGrant: (event) => {
          if (!canDraw) return;
          const { locationX, locationY } = event.nativeEvent;
          if (size.width === 0 || size.height === 0) return;
          const point = {
            x: Math.min(Math.max(locationX / size.width, 0), 1),
            y: Math.min(Math.max(locationY / size.height, 0), 1),
          };
          onPointerUpdate(point);
          const baseDimension = Math.min(size.width, size.height);
          const strokeSize = 6 / Math.max(baseDimension, 1);
          const strokeId = beginStroke(point, strokeSize);
          if (strokeId) {
            currentStrokeId.current = strokeId;
          }
        },
        onPanResponderMove: (event) => {
          if (!canDraw) return;
          const { locationX, locationY } = event.nativeEvent;
          if (size.width === 0 || size.height === 0) return;
          const point = {
            x: Math.min(Math.max(locationX / size.width, 0), 1),
            y: Math.min(Math.max(locationY / size.height, 0), 1),
          };
          onPointerUpdate(point);
          if (currentStrokeId.current) {
            appendToStroke(currentStrokeId.current, [point]);
          }
        },
        onPanResponderRelease: () => {
          if (!canDraw) return;
          if (currentStrokeId.current) {
            endStroke(currentStrokeId.current);
            currentStrokeId.current = null;
          }
          onPointerUpdate(null);
        },
        onPanResponderTerminate: () => {
          if (!canDraw) return;
          if (currentStrokeId.current) {
            cancelStroke(currentStrokeId.current);
            currentStrokeId.current = null;
          }
          onPointerUpdate(null);
        },
      }),
    [appendToStroke, beginStroke, cancelStroke, canDraw, endStroke, onPointerUpdate, size.height, size.width],
  );

  const canvasMetrics = useMemo(() => {
    const width = size.width;
    const height = size.height;
    const topInset = Math.min(Math.max(height * 0.12, 96), height * 0.3);
    const bottomInset = Math.min(Math.max(height * 0.08, 72), height * 0.25);
    const availableHeight = Math.max(height - topInset - bottomInset, height * 0.4);
    const totalLines = Math.max(6, Math.round(availableHeight / 120));
    const lineGap = availableHeight / totalLines;
    return { width, height, topInset, bottomInset, availableHeight, totalLines, lineGap };
  }, [size.height, size.width]);

  const paths = useMemo(() => {
    const baseDimension = Math.max(Math.min(canvasMetrics.width, canvasMetrics.height), 1);
    return strokes.map((stroke) => {
      const path = Skia.Path.Make();
      const points = stroke.points;
      if (points.length > 0) {
        path.moveTo(points[0].x * canvasMetrics.width, points[0].y * canvasMetrics.height);
        for (let i = 1; i < points.length; i += 1) {
          const point = points[i];
          path.lineTo(point.x * canvasMetrics.width, point.y * canvasMetrics.height);
        }
      }
      const strokeWidth = Math.max(stroke.size * baseDimension, 2.5);
      return (
        <Path
          key={stroke.id}
          path={path}
          color={stroke.color}
          strokeWidth={strokeWidth}
          style="stroke"
          strokeJoin="round"
          strokeCap="round"
        />
      );
    });
  }, [canvasMetrics, strokes]);

  const remotePointerElements = remotePointers
    .filter((pointer) => pointer.point)
    .map((pointer) => {
      const point = pointer.point!;
      return (
        <View
          key={pointer.id}
          style={[
            styles.pointer,
            {
              left: point.x * size.width,
              top: point.y * size.height,
            },
          ]}
        >
          <View
            style={[
              styles.pointerDot,
              {
                backgroundColor: pointer.color ?? '#4F46E5',
              },
            ]}
          />
      {pointer.displayName ?? pointer.participantId ? (
        <View
          style={[
            styles.pointerLabel,
            {
              backgroundColor: pointer.color ?? '#4F46E5',
            },
          ]}
        >
          <View
            style={[
              styles.pointerLabelDot,
              {
                borderColor: 'rgba(255,255,255,0.75)',
              },
            ]}
          />
          <Text style={styles.pointerLabelText}>{pointer.displayName ?? pointer.participantId}</Text>
        </View>
      ) : null}
        </View>
      );
    });

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width: Math.max(width, 1), height: Math.max(height, 1) });
      }}
      {...panResponder.panHandlers}
    >
      <Canvas style={styles.canvas} pointerEvents="none">
        <Path path={Skia.Path.MakeFromSVGString(`M0 0 H${canvasMetrics.width} V${canvasMetrics.height} H0Z`) ?? Skia.Path.Make()} color={CANVAS_BACKGROUND} style="fill" />
        {Array.from({ length: canvasMetrics.totalLines }).map((_, index) => {
          const y = canvasMetrics.topInset + (index + 1) * canvasMetrics.lineGap;
          const highlight = typeof activeStepIndex === 'number' && activeStepIndex >= 0 && index === Math.min(activeStepIndex, canvasMetrics.totalLines - 1);
          const guidePath = Skia.Path.Make();
          guidePath.moveTo(0, y);
          guidePath.lineTo(canvasMetrics.width, y);
          if (highlight) {
            const bandTop = canvasMetrics.topInset + index * canvasMetrics.lineGap;
            const bandBottom = canvasMetrics.topInset + (index + 1) * canvasMetrics.lineGap;
            const paddedTop = Math.max(bandTop - 12, 0);
            const paddedBottom = Math.min(bandBottom + 12, canvasMetrics.height);
            const highlightRect = Skia.Path.Make();
            highlightRect.addRect({ x: 0, y: paddedTop, width: canvasMetrics.width, height: paddedBottom - paddedTop });
            return (
              <React.Fragment key={`highlight-${index}`}>
                <Path
                  path={highlightRect}
                  color="rgba(14, 165, 233, 0.12)"
                  style="fill"
                />
                <Path
                  path={guidePath}
                  color={pointerColor}
                  strokeWidth={2}
                  style="stroke"
                  strokeCap="round"
                  strokeJoin="round"
                />
              </React.Fragment>
            );
          }
          return (
            <Path
              key={`guide-${index}`}
              path={guidePath}
              color="rgba(54, 69, 79, 0.08)"
              strokeWidth={1}
              style="stroke"
              strokeCap="round"
              strokeJoin="round"
              dash={[4, 8]}
            />
          );
        })}
        {paths}
      </Canvas>

      {remotePointerElements}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, !canDraw && styles.controlButtonDisabled]}
          onPress={onClear}
          activeOpacity={0.8}
          disabled={!canDraw}
        >
          <Text style={styles.controlText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, !canDraw && styles.controlButtonDisabled]}
          onPress={onEraseLast}
          activeOpacity={0.8}
          disabled={!canDraw}
        >
          <Text style={styles.controlText}>Undo</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.participantBadge, { borderColor: pointerColor }]}>
        <Text style={[styles.participantText, { color: pointerColor }]}>{localDisplayName ?? localParticipantId ?? 'You'}</Text>
      </View>

      {!canDraw && disabledReason ? (
        <View style={styles.disabledOverlay} pointerEvents="none">
          <Text style={styles.disabledText}>{disabledReason}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  canvas: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  controlText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pointer: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  pointerDot: {
    width: 12,
    height: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  pointerLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointerLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  pointerLabelText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  participantBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  participantText: {
    fontSize: 12,
    fontWeight: '600',
  },
  disabledOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(248,250,252,0.78)',
  },
  disabledText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
});


