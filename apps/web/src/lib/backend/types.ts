import type { CollectionMap, CollectionName, Profile, Settings } from '@fina/core';

/** Dónde vive un documento: tu espacio personal o el del hogar (modo pareja). */
export type Space = 'personal' | 'household';

export type AnyDoc = CollectionMap[CollectionName];

export type WriteOp =
  | { type: 'put'; space: Space; col: CollectionName; doc: AnyDoc }
  | { type: 'delete'; space: Space; col: CollectionName; id: string };

export interface MetaDoc {
  profile?: Profile;
  settings?: Partial<Settings>;
}

/**
 * Backend de datos intercambiable: IndexedDB (modo local, sin cuenta) o Firestore
 * (con cuenta, sincroniza entre dispositivos). La app no sabe cuál está usando.
 */
export interface DataBackend {
  readonly kind: 'local' | 'firebase';
  readonly uid: string;
  subscribe(space: Space, col: CollectionName, cb: (docs: AnyDoc[]) => void): () => void;
  subscribeMeta(cb: (meta: MetaDoc) => void): () => void;
  /** Escribe varios cambios a la vez (atómico en Firestore). No espera al servidor. */
  write(ops: WriteOp[]): Promise<void>;
  setMeta(patch: MetaDoc): Promise<void>;
  /** Borra TODOS los datos del usuario. */
  wipe(): Promise<void>;
  setHousehold(hid: string | null): void;
  dispose(): void;
}

export function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(stripUndefined) as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined && k !== 'space') out[k] = stripUndefined(v);
    return out as T;
  }
  return obj;
}
