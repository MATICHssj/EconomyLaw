import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'error' | 'info';
  actions?: ToastAction[];
  timeout: number;
}

interface UIState {
  toasts: Toast[];
  captureOpen: boolean;
  captureText: string;
  /** Viaje al que se guardará lo que se anote (al abrir la captura desde un viaje). */
  captureTripId: string | null;
  editingTxId: string | null;
  privacyPeek: boolean;
  locked: boolean;
  installEvent: BeforeInstallPromptEvent | null;
  swUpdate: (() => void) | null;
  openCapture(text?: string, tripId?: string | null): void;
  closeCapture(): void;
  editTx(id: string | null): void;
  pushToast(t: Omit<Toast, 'id' | 'timeout'> & { timeout?: number }): number;
  dismissToast(id: number): void;
  setLocked(v: boolean): void;
  setInstallEvent(e: BeforeInstallPromptEvent | null): void;
  setSwUpdate(fn: (() => void) | null): void;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let nextId = 1;

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  captureOpen: false,
  captureText: '',
  captureTripId: null,
  editingTxId: null,
  privacyPeek: false,
  locked: false,
  installEvent: null,
  swUpdate: null,
  openCapture(text = '', tripId = null) {
    set({ captureOpen: true, captureText: text, captureTripId: tripId });
  },
  closeCapture() {
    set({ captureOpen: false, captureText: '', captureTripId: null });
  },
  editTx(id) {
    set({ editingTxId: id });
  },
  pushToast(t) {
    const id = nextId++;
    const toast: Toast = { timeout: t.actions?.length ? 6000 : 3500, ...t, id };
    set({ toasts: [...get().toasts.slice(-2), toast] });
    if (toast.timeout > 0) setTimeout(() => get().dismissToast(id), toast.timeout);
    return id;
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  setLocked(v) {
    set({ locked: v });
  },
  setInstallEvent(e) {
    set({ installEvent: e });
  },
  setSwUpdate(fn) {
    set({ swUpdate: fn });
  },
}));

export function toast(text: string, tone: Toast['tone'] = 'default', actions?: ToastAction[]) {
  return useUI.getState().pushToast({ text, tone, actions });
}
