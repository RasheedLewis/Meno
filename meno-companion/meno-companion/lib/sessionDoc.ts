import * as Y from 'yjs';

export interface SessionDoc {
  strokes: Y.Array<Y.Map<unknown>>;
  meta: Y.Map<unknown>;
  events: Y.Array<unknown>;
}

export const ensureSessionDoc = (doc: Y.Doc): SessionDoc => {
  const strokes = doc.getArray<Y.Map<unknown>>('strokes');
  const meta = doc.getMap<unknown>('meta');
  const events = doc.getArray<unknown>('events');
  return { strokes, meta, events };
};

export const getStrokesArray = (session: SessionDoc) => session.strokes;

