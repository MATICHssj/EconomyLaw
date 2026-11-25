import { create } from 'zustand';
import {
  COLLECTIONS,
  HOUSEHOLD_COLLECTIONS,
  SettingsSchema,
  buildDefaultCategories,
  type CollectionMap,
  type CollectionName,
  type Household,
  type Profile,
  type Settings,
} from '@fina/core';
import type { AnyDoc, DataBackend, Space, WriteOp } from '@/lib/backend/types';

export type WithSpace<T> = T & { space: Space };
export type Collections = { [K in CollectionName]: WithSpace<CollectionMap[K]>[] };
export type SpaceFilter = 'all' | 'personal' | 'household';

const emptyCollections = (): Collections =>
  Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as Collections;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

interface DataState {
  backend: DataBackend | null;
  ready: boolean;
  metaLoaded: boolean;
  loaded: Set<CollectionName>;
  profile: Profile | null;
  settings: Settings;
  data: Collections;
  household: Household | null;
  spaceFilter: SpaceFilter;
  attach(backend: DataBackend): void;
  detach(): void;
  setHousehold(h: Household | null): void;
  setSpaceFilter(f: SpaceFilter): void;
  write(ops: WriteOp[]): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
}

let unsubs: Array<() => void> = [];
let householdUnsubs: Array<() => void> = [];
const personal: Partial<Record<CollectionName, AnyDoc[]>> = {};
const shared: Partial<Record<CollectionName, AnyDoc[]>> = {};

function merged(col: CollectionName): AnyDoc[] {
  const p = (personal[col] ?? []).map((d) => ({ ...d, space: 'personal' as const }));
  const h = (shared[col] ?? []).map((d) => ({ ...d, space: 'household' as const }));
  return [...p, ...h];
}

export const useData = create<DataState>((set, get) => ({
  backend: null,
  ready: false,
  metaLoaded: false,
  loaded: new Set(),
  profile: null,
  settings: DEFAULT_SETTINGS,
  data: emptyCollections(),
  household: null,
  spaceFilter: 'all',

  attach(backend) {
    get().detach();
    set({
      backend,
      ready: false,
      metaLoaded: false,
      loaded: new Set(),
      data: emptyCollections(),
      profile: null,
      settings: DEFAULT_SETTINGS,
    });
    for (const k of COLLECTIONS) {
      personal[k] = [];
      shared[k] = [];
    }
    unsubs.push(
      backend.subscribeMeta((meta) => {
        const settings = SettingsSchema.parse({ ...(meta.settings ?? {}) });
        set({ profile: meta.profile ?? null, settings, metaLoaded: true });
        try {
          localStorage.setItem(
            'fina:boot',
            JSON.stringify({
              theme: settings.theme,
              fontScale: settings.fontScale,
              accent: settings.accent,
            }),
          );
        } catch {
          /* sin almacenamiento */
        }
        const hid = meta.profile?.householdId ?? null;
        if (hid !== (get().household?.id ?? null) && backend.kind === 'firebase')
          void attachHousehold(backend, hid);
        if (!hid && get().household) {
          get().setHousehold(null);
        }
      }),
    );
    for (const col of COLLECTIONS) {
      unsubs.push(
        backend.subscribe('personal', col, (docs) => {
          personal[col] = docs;
          const loaded = new Set(get().loaded).add(col);
          set((s) => ({
            data: { ...s.data, [col]: merged(col) },
            loaded,
            ready: loaded.size === COLLECTIONS.length && s.metaLoaded,
          }));
          if (col === 'categories' && docs.length === 0) seedCategories(backend);
        }),
      );
    }
  },

  detach() {
    unsubs.forEach((u) => u());
    householdUnsubs.forEach((u) => u());
    unsubs = [];
    householdUnsubs = [];
    get().backend?.dispose();
    set({ backend: null, ready: false, household: null });
  },

  setHousehold(h) {
    set({ household: h });
  },

  setSpaceFilter(f) {
    set({ spaceFilter: f });
  },

  async write(ops) {
    const b = get().backend;
    if (!b) throw new Error('Sin backend');
    await b.write(ops);
  },

  async updateProfile(patch) {
    const b = get().backend;
    const current = get().profile ?? ({ createdAt: new Date().toISOString() } as Profile);
    const profile = { ...current, ...patch } as Profile;
    set({ profile });
    await b?.setMeta({ profile });
  },

  async updateSettings(patch) {
    const b = get().backend;
    const settings = { ...get().settings, ...patch };
    set({ settings });
    try {
      localStorage.setItem(
        'fina:boot',
        JSON.stringify({
          theme: settings.theme,
          fontScale: settings.fontScale,
          accent: settings.accent,
        }),
      );
    } catch {
      /* sin almacenamiento */
    }
    await b?.setMeta({ settings });
  },
}));

// Cuando metaLoaded llega después de las colecciones, marcamos "ready".
useData.subscribe((s, prev) => {
  if (s.metaLoaded && !prev.metaLoaded && s.loaded.size === COLLECTIONS.length && !s.ready)
    useData.setState({ ready: true });
});

let seeding = false;
function seedCategories(backend: DataBackend) {
  if (seeding) return;
  seeding = true;
  void backend
    .write(
      buildDefaultCategories().map((doc) => ({
        type: 'put',
        space: 'personal',
        col: 'categories',
        doc,
      })),
    )
    .finally(() => {
      seeding = false;
    });
}

async function attachHousehold(backend: DataBackend, hid: string | null) {
  householdUnsubs.forEach((u) => u());
  householdUnsubs = [];
  for (const col of HOUSEHOLD_COLLECTIONS) shared[col] = [];
  backend.setHousehold(hid);
  if (!hid) {
    useData.setState((s) => ({
      household: null,
      data: { ...s.data, ...Object.fromEntries(HOUSEHOLD_COLLECTIONS.map((c) => [c, merged(c)])) },
    }));
    return;
  }
  const { doc, onSnapshot } = await import('firebase/firestore');
  const { firebase } = await import('@/lib/firebase');
  householdUnsubs.push(
    onSnapshot(
      doc(firebase().db, 'households', hid),
      (snap) =>
        useData
          .getState()
          .setHousehold(snap.exists() ? { ...(snap.data() as Household), id: snap.id } : null),
      () => useData.getState().setHousehold(null),
    ),
  );
  for (const col of HOUSEHOLD_COLLECTIONS) {
    householdUnsubs.push(
      backend.subscribe('household', col, (docs) => {
        shared[col] = docs;
        useData.setState((s) => ({ data: { ...s.data, [col]: merged(col) } }));
      }),
    );
  }
}

/** Documentos de una colección según el filtro de espacio (Todo / Personal / Hogar). */
export function useDocs<K extends CollectionName>(col: K): WithSpace<CollectionMap[K]>[] {
  const docs = useData((s) => s.data[col]);
  const filter = useData((s) => s.spaceFilter);
  const hasHousehold = useData((s) => !!s.household);
  if (!hasHousehold || filter === 'all') return docs;
  return filterSpace(docs, filter);
}

const filterCache = new WeakMap<object, Map<string, unknown>>();
function filterSpace<T extends { space: Space }>(docs: T[], f: SpaceFilter): T[] {
  let m = filterCache.get(docs);
  if (!m) filterCache.set(docs, (m = new Map()));
  const hit = m.get(f) as T[] | undefined;
  if (hit) return hit;
  const out = docs.filter((d) => d.space === f);
  m.set(f, out);
  return out;
}

export function getDocs<K extends CollectionName>(col: K): WithSpace<CollectionMap[K]>[] {
  return useData.getState().data[col];
}
