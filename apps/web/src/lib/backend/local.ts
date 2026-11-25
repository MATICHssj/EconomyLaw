import { openDB, type IDBPDatabase } from 'idb';
import { COLLECTIONS, type CollectionName } from '@fina/core';
import {
  stripUndefined,
  type AnyDoc,
  type DataBackend,
  type MetaDoc,
  type Space,
  type WriteOp,
} from './types';

const DB_NAME = 'fina-local';
const DB_VERSION = 2;

type Listener = (docs: AnyDoc[]) => void;

/**
 * Modo local: todo se guarda en este dispositivo (IndexedDB). Funciona sin
 * internet y sin cuenta. Se sincroniza entre pestañas con BroadcastChannel.
 */
export class LocalBackend implements DataBackend {
  readonly kind = 'local' as const;
  readonly uid = 'local';
  /** null = IndexedDB no disponible (navegación privada, vista previa): se usa solo memoria. */
  private db: Promise<IDBPDatabase | null>;
  private cache = new Map<CollectionName, Map<string, AnyDoc>>();
  private listeners = new Map<CollectionName, Set<Listener>>();
  private metaListeners = new Set<(m: MetaDoc) => void>();
  private meta: MetaDoc = {};
  private channel: BroadcastChannel | null = null;
  private loaded = new Map<CollectionName, Promise<void>>();

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const col of COLLECTIONS)
          if (!db.objectStoreNames.contains(col)) db.createObjectStore(col, { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      },
    }).catch(() => null);
    try {
      this.channel = new BroadcastChannel('fina-local');
      this.channel.onmessage = (e: MessageEvent<{ col?: CollectionName; meta?: boolean }>) => {
        if (e.data.meta) void this.reloadMeta();
        if (e.data.col) void this.reload(e.data.col);
      };
    } catch {
      this.channel = null;
    }
  }

  private async reload(col: CollectionName) {
    const db = await this.db;
    const all = db
      ? ((await db.getAll(col).catch(() => [])) as AnyDoc[])
      : [...(this.cache.get(col)?.values() ?? [])];
    this.cache.set(col, new Map(all.map((d) => [d.id, d])));
    this.emit(col);
  }

  private async reloadMeta() {
    const db = await this.db;
    if (db)
      this.meta =
        ((await db.get('meta', 'me').catch(() => undefined)) as MetaDoc | undefined) ?? {};
    for (const l of this.metaListeners) l(this.meta);
  }

  private emit(col: CollectionName) {
    const docs = [...(this.cache.get(col)?.values() ?? [])];
    for (const l of this.listeners.get(col) ?? []) l(docs);
  }

  subscribe(space: Space, col: CollectionName, cb: Listener): () => void {
    if (space !== 'personal') {
      cb([]);
      return () => {};
    }
    let set = this.listeners.get(col);
    if (!set) this.listeners.set(col, (set = new Set()));
    set.add(cb);
    if (!this.loaded.has(col)) this.loaded.set(col, this.reload(col));
    else if (this.cache.has(col)) cb([...this.cache.get(col)!.values()]);
    return () => set!.delete(cb);
  }

  subscribeMeta(cb: (m: MetaDoc) => void): () => void {
    this.metaListeners.add(cb);
    void this.reloadMeta();
    return () => this.metaListeners.delete(cb);
  }

  async write(ops: WriteOp[]): Promise<void> {
    const personal = ops.filter((o) => o.space === 'personal');
    if (!personal.length) return;
    const touched = new Set<CollectionName>();
    // Actualiza la memoria primero para que la interfaz responda al instante.
    for (const op of personal) {
      let map = this.cache.get(op.col);
      if (!map) this.cache.set(op.col, (map = new Map()));
      if (op.type === 'put') map.set(op.doc.id, stripUndefined(op.doc));
      else map.delete(op.id);
      touched.add(op.col);
    }
    for (const col of touched) this.emit(col);
    const db = await this.db;
    if (!db) return;
    const tx = db.transaction([...touched], 'readwrite');
    for (const op of personal) {
      const store = tx.objectStore(op.col);
      if (op.type === 'put') void store.put(stripUndefined(op.doc));
      else void store.delete(op.id);
    }
    await tx.done;
    for (const col of touched) this.channel?.postMessage({ col });
  }

  async setMeta(patch: MetaDoc): Promise<void> {
    this.meta = {
      profile: patch.profile
        ? { ...(this.meta.profile ?? {}), ...patch.profile }
        : this.meta.profile,
      settings: patch.settings
        ? { ...(this.meta.settings ?? {}), ...patch.settings }
        : this.meta.settings,
    } as MetaDoc;
    for (const l of this.metaListeners) l(this.meta);
    const db = await this.db;
    if (db) await db.put('meta', stripUndefined(this.meta), 'me');
    this.channel?.postMessage({ meta: true });
  }

  async wipe(): Promise<void> {
    const db = await this.db;
    if (db) {
      const tx = db.transaction([...COLLECTIONS, 'meta'], 'readwrite');
      for (const col of COLLECTIONS) void tx.objectStore(col).clear();
      void tx.objectStore('meta').clear();
      await tx.done;
    }
    this.cache.clear();
    this.meta = {};
    for (const col of COLLECTIONS) this.emit(col);
    for (const l of this.metaListeners) l(this.meta);
    this.channel?.postMessage({ meta: true });
  }

  setHousehold(): void {}

  dispose(): void {
    this.channel?.close();
    this.listeners.clear();
    this.metaListeners.clear();
  }

  /** Todos los documentos locales (para subirlos a la nube al crear cuenta). */
  async exportAll(): Promise<{ meta: MetaDoc; data: Partial<Record<CollectionName, AnyDoc[]>> }> {
    const db = await this.db;
    const data: Partial<Record<CollectionName, AnyDoc[]>> = {};
    for (const col of COLLECTIONS) data[col] = db ? ((await db.getAll(col)) as AnyDoc[]) : [];
    return { meta: db ? (((await db.get('meta', 'me')) as MetaDoc | undefined) ?? {}) : {}, data };
  }
}
