import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

import { ensureSessionDoc, getStrokesArray } from '@/lib/sessionDoc';
import { randomId } from '@/lib/randomId';
import type { YjsSessionConnection } from '@/hooks/use-session-yjs';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface SharedStroke {
  id: string;
  color: string;
  size: number;
  points: CanvasPoint[];
  author?: string | null;
  createdAt: number;
  updatedAt: number;
}

const POINT_BATCH_SIZE = 16;

interface StrokeEntry {
  map: Y.Map<unknown>;
  points: Y.Array<number>;
  buffer: number[];
}

export interface BeginStrokeOptions {
  color: string;
  size: number;
  author?: string | null;
  start: CanvasPoint;
}

export interface UseSharedCanvasResult {
  strokes: SharedStroke[];
  beginStroke: (options: BeginStrokeOptions) => string | null;
  appendToStroke: (strokeId: string, points: CanvasPoint[]) => void;
  endStroke: (strokeId: string) => void;
  cancelStroke: (strokeId: string) => void;
  clear: () => void;
  eraseStroke: (strokeId: string) => void;
  awareness: YjsSessionConnection['awareness'] | null;
  doc: Y.Doc | null;
}

const flattenPoints = (points: CanvasPoint[]) => {
  const result: number[] = [];
  for (const point of points) {
    result.push(point.x, point.y);
  }
  return result;
};

const inflatePoints = (values: number[]): CanvasPoint[] => {
  const result: CanvasPoint[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (typeof x === 'number' && typeof y === 'number') {
      result.push({ x, y });
    }
  }
  return result;
};

export function useSharedCanvas(connection: YjsSessionConnection | null): UseSharedCanvasResult {
  const [strokes, setStrokes] = useState<SharedStroke[]>([]);
  const strokesArrayRef = useRef<Y.Array<Y.Map<unknown>> | null>(null);
  const strokeEntriesRef = useRef<Map<string, StrokeEntry>>(new Map());

  const flushEntryBuffer = useCallback((entry?: StrokeEntry) => {
    if (!entry || entry.buffer.length === 0) return;
    const values = entry.buffer;
    entry.buffer = [];
    entry.points.push(values);
  }, []);

  useEffect(() => {
    if (!connection) {
      strokesArrayRef.current = null;
      strokeEntriesRef.current.clear();
      setStrokes([]);
      return;
    }

    const session = ensureSessionDoc(connection.doc);
    const strokesArray = getStrokesArray(session);
    strokesArrayRef.current = strokesArray;

    const updateStrokes = () => {
      const entries = new Map<string, StrokeEntry>();
      const result: SharedStroke[] = [];
      const now = Date.now();

      for (const strokeMap of strokesArray) {
        const id = strokeMap.get('id') as string | undefined;
        if (!id) continue;
        const color = (strokeMap.get('color') as string | undefined) ?? '#2B8A9C';
        const size = typeof strokeMap.get('size') === 'number' ? (strokeMap.get('size') as number) : 0.01;
        const author = (strokeMap.get('author') as string | undefined) ?? null;
        const createdAt =
          typeof strokeMap.get('createdAt') === 'number' ? (strokeMap.get('createdAt') as number) : now;
        const updatedAt =
          typeof strokeMap.get('updatedAt') === 'number' ? (strokeMap.get('updatedAt') as number) : createdAt;
        const pointsArray = strokeMap.get('points') as Y.Array<number> | undefined;
        if (!pointsArray) continue;

        const existing = strokeEntriesRef.current.get(id);
        entries.set(id, {
          map: strokeMap,
          points: pointsArray,
          buffer: existing?.buffer ?? [],
        });

        const flattened = pointsArray.toArray();
        if (existing?.buffer?.length) {
          flattened.push(...existing.buffer);
        }

        result.push({
          id,
          color,
          size,
          author,
          createdAt,
          updatedAt,
          points: inflatePoints(flattened),
        });
      }

      strokeEntriesRef.current = entries;
      setStrokes(result);
    };

    updateStrokes();

    const arrayObserver = () => {
      updateStrokes();
    };
    const docObserver = () => {
      updateStrokes();
    };

    strokesArray.observe(arrayObserver);
    connection.doc.on('update', docObserver);

    return () => {
      strokesArray.unobserve(arrayObserver);
      connection.doc.off('update', docObserver);
    };
  }, [connection]);

  const withEntry = useCallback((strokeId: string, fn: (entry: StrokeEntry) => void) => {
    const entry = strokeEntriesRef.current.get(strokeId);
    if (!entry) return;
    fn(entry);
  }, []);

  const beginStroke = useCallback(
    (options: BeginStrokeOptions) => {
      if (!connection || !strokesArrayRef.current) return null;

      const strokeId = randomId('stroke');
      const strokeMap = new Y.Map<unknown>();
      const pointsArray = new Y.Array<number>();

      strokeMap.set('id', strokeId);
      strokeMap.set('color', options.color);
      strokeMap.set('size', options.size);
      strokeMap.set('author', options.author ?? null);
      strokeMap.set('createdAt', Date.now());
      strokeMap.set('updatedAt', Date.now());
      strokeMap.set('points', pointsArray);

      connection.doc.transact(() => {
        strokesArrayRef.current?.push([strokeMap]);
        pointsArray.push(flattenPoints([options.start]));
      });

      strokeEntriesRef.current.set(strokeId, {
        map: strokeMap,
        points: pointsArray,
        buffer: [],
      });

      return strokeId;
    },
    [connection],
  );

  const appendToStroke = useCallback(
    (strokeId: string, points: CanvasPoint[]) => {
      if (!connection || !points.length) return;
      withEntry(strokeId, (entry) => {
        entry.buffer.push(...flattenPoints(points));
        if (entry.buffer.length / 2 >= POINT_BATCH_SIZE) {
          connection.doc.transact(() => {
            flushEntryBuffer(entry);
            entry.map.set('updatedAt', Date.now());
          });
        }
      });
    },
    [connection, flushEntryBuffer, withEntry],
  );

  const endStroke = useCallback(
    (strokeId: string) => {
      if (!connection) return;
      withEntry(strokeId, (entry) => {
        connection.doc.transact(() => {
          flushEntryBuffer(entry);
          entry.map.set('updatedAt', Date.now());
        });
      });
    },
    [connection, flushEntryBuffer, withEntry],
  );

  const cancelStroke = useCallback(
    (strokeId: string) => {
      if (!connection || !strokesArrayRef.current) return;
      const strokesArray = strokesArrayRef.current;
      const index = strokesArray.toArray().findIndex((map) => map.get('id') === strokeId);
      if (index >= 0) {
        connection.doc.transact(() => {
          strokesArray.delete(index, 1);
        });
      }
    },
    [connection],
  );

  const eraseStroke = useCallback(
    (strokeId: string) => {
      if (!connection || !strokesArrayRef.current) return;
      const strokesArray = strokesArrayRef.current;
      const index = strokesArray.toArray().findIndex((map) => map.get('id') === strokeId);
      if (index >= 0) {
        connection.doc.transact(() => {
          strokesArray.delete(index, 1);
        });
      }
    },
    [connection],
  );

  const clear = useCallback(() => {
    if (!connection || !strokesArrayRef.current) return;
    const strokesArray = strokesArrayRef.current;
    connection.doc.transact(() => {
      strokesArray.delete(0, strokesArray.length);
    });
  }, [connection]);

  useEffect(() => {
    return () => {
      strokeEntriesRef.current.forEach((entry) => {
        flushEntryBuffer(entry);
      });
    };
  }, [flushEntryBuffer]);

  return useMemo(
    () => ({
      strokes,
      beginStroke,
      appendToStroke,
      endStroke,
      cancelStroke,
      clear,
      eraseStroke,
      awareness: connection?.awareness ?? null,
      doc: connection?.doc ?? null,
    }),
    [appendToStroke, beginStroke, cancelStroke, clear, connection, endStroke, eraseStroke, strokes],
  );
}


