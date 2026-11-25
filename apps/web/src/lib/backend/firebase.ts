import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS, HOUSEHOLD_COLLECTIONS, type CollectionName } from '@fina/core';
import { firebase } from '@/lib/firebase';
import {
  stripUndefined,
  type AnyDoc,
  type DataBackend,
  type MetaDoc,
  type Space,
  type WriteOp,
} from './types';

/**
 * Modo nube: Firestore con caché persistente. Las escrituras se aplican al
 * instante en la caché local (también sin internet) y se suben al reconectar.
 */
export class FirebaseBackend implements DataBackend {
  readonly kind = 'firebase' as const;
  private db: Firestore;
  private householdId: string | null = null;
  private onError: (e: unknown) => void;

  constructor(
    readonly uid: string,
    onError: (e: unknown) => void,
  ) {
    this.db = firebase().db;
    this.onError = onError;
  }

  private colRef(space: Space, col: CollectionName) {
    if (space === 'household') {
      if (!this.householdId) throw new Error('Sin hogar');
      return collection(this.db, 'households', this.householdId, col);
    }
    return collection(this.db, 'users', this.uid, col);
  }

  setHousehold(hid: string | null) {
    this.householdId = hid;
  }

  subscribe(space: Space, col: CollectionName, cb: (docs: AnyDoc[]) => void): () => void {
    if (space === 'household' && (!this.householdId || !HOUSEHOLD_COLLECTIONS.includes(col))) {
      cb([]);
      return () => {};
    }
    return onSnapshot(
      this.colRef(space, col),
      { includeMetadataChanges: false },
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as AnyDoc), id: d.id }))),
      (e) => this.onError(e),
    );
  }

  subscribeMeta(cb: (meta: MetaDoc) => void): () => void {
    return onSnapshot(
      doc(this.db, 'users', this.uid),
      (snap) => cb((snap.data() as MetaDoc | undefined) ?? {}),
      (e) => this.onError(e),
    );
  }

  async write(ops: WriteOp[]): Promise<void> {
    // Firestore limita los lotes a 500 operaciones.
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(this.db);
      for (const op of ops.slice(i, i + 450)) {
        const ref = doc(this.colRef(op.space, op.col), op.type === 'put' ? op.doc.id : op.id);
        if (op.type === 'put') batch.set(ref, stripUndefined(op.doc));
        else batch.delete(ref);
      }
      // No esperamos al servidor: con caché persistente el cambio ya es visible.
      batch.commit().catch(this.onError);
    }
  }

  async setMeta(patch: MetaDoc): Promise<void> {
    setDoc(doc(this.db, 'users', this.uid), stripUndefined(patch), { merge: true }).catch(
      this.onError,
    );
  }

  async wipe(): Promise<void> {
    for (const col of COLLECTIONS) {
      const snap = await getDocs(collection(this.db, 'users', this.uid, col));
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(this.db);
        snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(doc(this.db, 'users', this.uid));
  }

  dispose(): void {}
}
