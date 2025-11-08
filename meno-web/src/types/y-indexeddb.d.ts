declare module "y-indexeddb" {
  export class IndexeddbPersistence {
    constructor(name: string, doc: import("yjs").Doc);
    whenSynced: Promise<unknown>;
    destroy(): void;
  }
}


