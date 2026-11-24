import { create } from 'zustand';
import { config } from '@/config';
import { LocalBackend } from '@/lib/backend/local';
import { useData } from './data';
import { toast } from './ui';

export interface SessionUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
}

interface SessionState {
  status: 'loading' | 'signedOut' | 'ready';
  mode: 'local' | 'firebase' | null;
  user: SessionUser | null;
  init(): void;
  startLocal(): void;
  signOut(): Promise<void>;
}

const MODE_KEY = 'fina:mode';

function readMode(): string | null {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}

function writeMode(v: string | null) {
  try {
    if (v) localStorage.setItem(MODE_KEY, v);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

let authUnsub: (() => void) | null = null;

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  mode: null,
  user: null,

  init() {
    if (!config.firebase) {
      get().startLocal();
      return;
    }
    void (async () => {
      const fb = await import('@/lib/firebase');
      const { FirebaseBackend } = await import('@/lib/backend/firebase');
      authUnsub?.();
      authUnsub = fb.watchAuth((user) => {
        if (user) {
          writeMode('firebase');
          set({
            status: 'ready',
            mode: 'firebase',
            user: { uid: user.uid, name: user.displayName ?? '', email: user.email ?? '', photoURL: user.photoURL },
          });
          useData.getState().attach(
            new FirebaseBackend(user.uid, (e) => {
              console.error(e);
              const code = (e as { code?: string })?.code;
              if (code === 'permission-denied') toast('No tienes permiso para esa acción.', 'error');
            }),
          );
        } else if (readMode() === 'local') {
          get().startLocal();
        } else {
          useData.getState().detach();
          set({ status: 'signedOut', mode: null, user: null });
        }
      });
    })();
  },

  startLocal() {
    writeMode('local');
    set({ status: 'ready', mode: 'local', user: { uid: 'local', name: '', email: '', photoURL: null } });
    useData.getState().attach(new LocalBackend());
  },

  async signOut() {
    const { mode } = get();
    writeMode(null);
    useData.getState().detach();
    if (mode === 'firebase') {
      const fb = await import('@/lib/firebase');
      await fb.logOut();
    }
    set({ status: config.firebase ? 'signedOut' : 'ready', mode: null, user: null });
    if (!config.firebase) get().startLocal();
  },
}));
