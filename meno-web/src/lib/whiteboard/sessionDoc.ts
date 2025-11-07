import * as Y from "yjs";

export interface SessionDoc {
  steps: Y.Array<Y.Doc>;
  sessionMeta: Y.Map<unknown>;
  events: Y.Array<unknown>;
}

export const ensureSessionDoc = (doc: Y.Doc): SessionDoc => {
  const steps = doc.getArray<Y.Doc>("steps");
  const sessionMeta = doc.getMap<unknown>("sessionMeta");
  const events = doc.getArray<unknown>("events");
  return { steps, sessionMeta, events };
};


