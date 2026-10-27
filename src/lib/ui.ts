import { useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

/** "3 minutes ago" — the only date-fns call the web app made on these screens. */
export function relativeTime(iso: string | Date): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  const s = Math.round((Date.now() - t) / 1000);
  const abs = Math.abs(s);
  const unit = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`;
  const txt =
    abs < 45 ? 'less than a minute'
    : abs < 3600 ? unit(Math.round(abs / 60), 'minute')
    : abs < 86400 ? unit(Math.round(abs / 3600), 'hour')
    : abs < 2592000 ? unit(Math.round(abs / 86400), 'day')
    : abs < 31536000 ? unit(Math.round(abs / 2592000), 'month')
    : unit(Math.round(abs / 31536000), 'year');
  return s >= 0 ? `${txt} ago` : `in ${txt}`;
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const errMsg = (e: unknown, fallback = 'Something went wrong') =>
  e instanceof Error ? e.message : (e as any)?.message ?? fallback;

// ---- tiny toast (no library): module state + one host component -------------------------
export interface ToastItem { id: number; kind: 'success' | 'error' | 'info'; text: string }
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

export const toast = {
  show(kind: ToastItem['kind'], text: string) {
    const id = ++seq;
    items = [...items, { id, kind, text }];
    emit();
    setTimeout(() => { items = items.filter((t) => t.id !== id); emit(); }, kind === 'error' ? 6000 : 3500);
  },
  success: (text: string) => toast.show('success', text),
  error: (text: string, description?: string) => toast.show('error', description ? `${text}: ${description}` : text),
  info: (text: string) => toast.show('info', text),
};

export const useToasts = () =>
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => items,
    () => items
  );

// ---- confirm(): window.confirm on web, Alert on native -----------------------------------
export const confirm = (message: string): Promise<boolean> => {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('Please confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ])
  );
};
