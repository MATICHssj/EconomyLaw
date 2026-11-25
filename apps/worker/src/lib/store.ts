import type { Env } from '../env';
import { accessToken } from './google';

/**
 * Acceso a Firestore. Interfaz mínima para que el bot y el cron se puedan probar
 * con un almacén en memoria, y una implementación real vía REST.
 */
export type Where = [field: string, op: '==' | '>=' | '<=' | '<' | '>', value: string | number | boolean];

export interface Store {
  get<T = Record<string, unknown>>(path: string): Promise<T | null>;
  set(path: string, data: object): Promise<void>;
  /** Actualiza solo los campos dados. Un valor `undefined` borra el campo. */
  patch(path: string, data: Record<string, unknown>): Promise<void>;
  delete(path: string): Promise<void>;
  list<T = Record<string, unknown>>(collectionPath: string): Promise<T[]>;
  query<T = Record<string, unknown>>(collectionPath: string, where: Where[], limit?: number): Promise<T[]>;
  commit(ops: Array<{ set: { path: string; data: object } } | { delete: string }>): Promise<void>;
  /** ids de documentos de una colección (sin leer su contenido). */
  listIds(collectionPath: string): Promise<string[]>;
  subcollections(docPath: string): Promise<string[]>;
}

// ——————————————————— Codificación de valores de Firestore ———————————————————

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } }
  | { timestampValue: string };

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

export function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

export function decodeValue(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}

export function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

// ——————————————————— Implementación REST ———————————————————

export class FirestoreStore implements Store {
  private base: string;
  constructor(
    private env: Env,
    private fetcher: typeof fetch = fetch,
  ) {
    this.base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  }

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await accessToken(this.env, this.fetcher);
    return this.fetcher(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  }

  private docName(path: string) {
    return `projects/${this.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  }

  async get<T>(path: string): Promise<T | null> {
    const res = await this.req(`${this.base}/${path}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore get ${res.status}`);
    const json = (await res.json()) as { fields?: Record<string, FsValue> };
    return decodeFields(json.fields ?? {}) as T;
  }

  async set(path: string, data: object): Promise<void> {
    const res = await this.req(`${this.base}/${path}`, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data as Record<string, unknown>) }) });
    if (!res.ok) throw new Error(`Firestore set ${res.status}`);
  }

  async patch(path: string, data: Record<string, unknown>): Promise<void> {
    const mask = Object.keys(data)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');
    const res = await this.req(`${this.base}/${path}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) });
    if (!res.ok) throw new Error(`Firestore patch ${res.status}`);
  }

  async delete(path: string): Promise<void> {
    const res = await this.req(`${this.base}/${path}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Firestore delete ${res.status}`);
  }

  async list<T>(collectionPath: string): Promise<T[]> {
    const out: T[] = [];
    let pageToken = '';
    do {
      const res = await this.req(`${this.base}/${collectionPath}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
      if (!res.ok) throw new Error(`Firestore list ${res.status}`);
      const json = (await res.json()) as { documents?: Array<{ name: string; fields?: Record<string, FsValue> }>; nextPageToken?: string };
      for (const d of json.documents ?? []) out.push({ id: d.name.split('/').pop(), ...decodeFields(d.fields ?? {}) } as T);
      pageToken = json.nextPageToken ?? '';
    } while (pageToken);
    return out;
  }

  async listIds(collectionPath: string): Promise<string[]> {
    const out: string[] = [];
    let pageToken = '';
    do {
      const res = await this.req(`${this.base}/${collectionPath}?pageSize=300&mask.fieldPaths=__name__&showMissing=true${pageToken ? `&pageToken=${pageToken}` : ''}`);
      if (!res.ok) throw new Error(`Firestore listIds ${res.status}`);
      const json = (await res.json()) as { documents?: Array<{ name: string }>; nextPageToken?: string };
      for (const d of json.documents ?? []) out.push(d.name.split('/').pop()!);
      pageToken = json.nextPageToken ?? '';
    } while (pageToken);
    return out;
  }

  async query<T>(collectionPath: string, where: Where[], limit = 1000): Promise<T[]> {
    const parts = collectionPath.split('/');
    const collectionId = parts.pop()!;
    const parent = parts.length ? `${this.base}/${parts.join('/')}` : this.base;
    const opMap = { '==': 'EQUAL', '>=': 'GREATER_THAN_OR_EQUAL', '<=': 'LESS_THAN_OR_EQUAL', '<': 'LESS_THAN', '>': 'GREATER_THAN' } as const;
    const filters = where.map(([field, op, value]) => ({ fieldFilter: { field: { fieldPath: field }, op: opMap[op], value: encodeValue(value) } }));
    const structuredQuery = {
      from: [{ collectionId }],
      where: filters.length === 1 ? filters[0] : filters.length ? { compositeFilter: { op: 'AND', filters } } : undefined,
      limit,
    };
    const res = await this.req(`${parent}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
    if (!res.ok) throw new Error(`Firestore query ${res.status}`);
    const rows = (await res.json()) as Array<{ document?: { name: string; fields?: Record<string, FsValue> } }>;
    return rows.filter((r) => r.document).map((r) => ({ id: r.document!.name.split('/').pop(), ...decodeFields(r.document!.fields ?? {}) }) as T);
  }

  async commit(ops: Array<{ set: { path: string; data: object } } | { delete: string }>): Promise<void> {
    for (let i = 0; i < ops.length; i += 450) {
      const writes = ops.slice(i, i + 450).map((op) => ('set' in op ? { update: { name: this.docName(op.set.path), fields: encodeFields(op.set.data as Record<string, unknown>) } } : { delete: this.docName(op.delete) }));
      const res = await this.req(`${this.base}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
      if (!res.ok) throw new Error(`Firestore commit ${res.status}`);
    }
  }

  async subcollections(docPath: string): Promise<string[]> {
    const res = await this.req(`${this.base}/${docPath}:listCollectionIds`, { method: 'POST', body: JSON.stringify({ pageSize: 100 }) });
    if (!res.ok) return [];
    return ((await res.json()) as { collectionIds?: string[] }).collectionIds ?? [];
  }
}

// ——————————————————— En memoria (pruebas) ———————————————————

export class MemoryStore implements Store {
  docs = new Map<string, Record<string, unknown>>();
  async get<T>(path: string) {
    const d = this.docs.get(path);
    return d ? (structuredClone(d) as T) : null;
  }
  async set(path: string, data: object) {
    this.docs.set(path, structuredClone(data) as Record<string, unknown>);
  }
  async patch(path: string, data: Record<string, unknown>) {
    const cur = this.docs.get(path) ?? {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) delete cur[k];
      else cur[k] = structuredClone(v);
    }
    this.docs.set(path, cur);
  }
  async delete(path: string) {
    this.docs.delete(path);
  }
  private children(collectionPath: string) {
    const depth = collectionPath.split('/').length + 1;
    return [...this.docs.entries()].filter(([p]) => p.startsWith(`${collectionPath}/`) && p.split('/').length === depth);
  }
  async list<T>(collectionPath: string) {
    return this.children(collectionPath).map(([p, d]) => ({ id: p.split('/').pop(), ...structuredClone(d) }) as T);
  }
  async listIds(collectionPath: string) {
    const depth = collectionPath.split('/').length + 1;
    const ids = new Set<string>();
    for (const p of this.docs.keys()) if (p.startsWith(`${collectionPath}/`)) ids.add(p.split('/').slice(0, depth).pop()!);
    return [...ids];
  }
  async query<T>(collectionPath: string, where: Where[], limit = 1000) {
    const rows = await this.list<Record<string, unknown>>(collectionPath);
    const ok = (r: Record<string, unknown>) =>
      where.every(([f, op, v]) => {
        const x = r[f] as string | number;
        return op === '==' ? x === v : op === '>=' ? x >= v : op === '<=' ? x <= v : op === '<' ? x < v : x > v;
      });
    return rows.filter(ok).slice(0, limit) as T[];
  }
  async commit(ops: Array<{ set: { path: string; data: object } } | { delete: string }>) {
    for (const op of ops) {
      if ('set' in op) await this.set(op.set.path, op.set.data);
      else await this.delete(op.delete);
    }
  }
  async subcollections(docPath: string) {
    const depth = docPath.split('/').length + 1;
    const cols = new Set<string>();
    for (const p of this.docs.keys()) if (p.startsWith(`${docPath}/`)) cols.add(p.split('/')[depth - 1]!);
    return [...cols];
  }
}
