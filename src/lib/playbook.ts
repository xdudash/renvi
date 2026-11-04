// Playbook progress and access. The server (playbook_progress, migration 0034) is the source of truth; a per-user
// copy in AsyncStorage keeps the list usable offline and is merged back on the next load.
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { onUserReset } from './userState';
import { initPurchases, ownsPlaybookInStore } from './purchases';

export const FREE_LESSON = 2;
export const LESSON_COUNT = 8;
export const TRAINER_COUNT = 30;

export type PlaybookState = {
  uid: string | null;
  loaded: boolean;
  purchased: boolean;
  done: number[];
  trainerPos: number; // index of the next situation, 0…TRAINER_COUNT
};

const EMPTY: PlaybookState = { uid: null, loaded: false, purchased: false, done: [], trainerPos: 0 };
let state: PlaybookState = EMPTY;
const listeners = new Set<() => void>();
const set = (patch: Partial<PlaybookState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  if (state.uid) AsyncStorage.setItem(cacheKey(state.uid), JSON.stringify({ purchased: state.purchased, done: state.done, trainerPos: state.trainerPos })).catch(() => {});
};
const cacheKey = (uid: string) => `renvi.playbook.${uid}`;
onUserReset(() => { state = EMPTY; listeners.forEach((l) => l()); });

type ServerState = { purchased: boolean; done_lessons: number[]; trainer_pos: number };
const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

let loading: Promise<void> | null = null;

/** Loads (once per user) cache → server, then asks the store whether a purchase has not reached the server yet. */
export function loadPlaybook(uid: string): Promise<void> {
  if (state.uid === uid && (state.loaded || loading)) return loading ?? Promise.resolve();
  state = { ...EMPTY, uid };
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(uid)).catch(() => null);
      if (raw && state.uid === uid) {
        const c = JSON.parse(raw) as Partial<PlaybookState>;
        set({ purchased: !!c.purchased, done: uniq(c.done ?? []), trainerPos: c.trainerPos ?? 0 });
      }
      const local = state.done;
      const { data, error } = await supabase.rpc('playbook_state');
      if (state.uid !== uid) return;
      if (!error && data) {
        const s = data as ServerState;
        set({ purchased: s.purchased, done: uniq([...s.done_lessons, ...local]), trainerPos: Math.max(s.trainer_pos, state.trainerPos) });
        // Lessons finished offline: send them now (the server ignores duplicates).
        for (const n of local.filter((n) => !s.done_lessons.includes(n))) supabase.rpc('playbook_mark_done', { p_lesson: n }).then(() => {}, () => {});
      }
      await initPurchases(uid).catch(() => {});
      if (!state.purchased && (await ownsPlaybookInStore()) && state.uid === uid) {
        set({ purchased: true });
        syncPurchase().catch(() => {});
      }
    } finally {
      if (state.uid === uid) set({ loaded: true });
      loading = null;
    }
  })();
  return loading;
}

export function usePlaybook(uid: string | null | undefined): PlaybookState {
  const snap = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
  useEffect(() => { if (uid) loadPlaybook(uid); }, [uid]);
  return snap.uid === uid ? snap : EMPTY;
}

export const isUnlocked = (s: PlaybookState, lesson: number) => lesson === FREE_LESSON || s.purchased;

export function markLessonDone(lesson: number) {
  if (!state.uid || state.done.includes(lesson)) return;
  set({ done: uniq([...state.done, lesson]) });
  supabase.rpc('playbook_mark_done', { p_lesson: lesson }).then(() => {}, () => {});
}

export function setTrainerPos(pos: number) {
  if (!state.uid) return;
  const p = Math.max(0, Math.min(TRAINER_COUNT, pos));
  set({ trainerPos: p });
  supabase.rpc('playbook_set_trainer', { p_pos: p }).then(() => {}, () => {});
  if (p >= TRAINER_COUNT) markLessonDone(8);
}

/** Lesson the "Next" card points to: the first unfinished one, free lesson first for a new user. */
export function nextLesson(s: PlaybookState): number | null {
  const order = s.purchased || s.done.includes(FREE_LESSON) ? [1, 2, 3, 4, 5, 6, 7, 8] : [FREE_LESSON, 1, 3, 4, 5, 6, 7, 8];
  return order.find((n) => !s.done.includes(n)) ?? null;
}

/**
 * Asks the server to check the purchase with RevenueCat (playbook-sync). Retries a few times: right after a
 * purchase RevenueCat may need a moment. The local flag stays on either way — the store already confirmed it.
 */
export async function syncPurchase(attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.functions.invoke('playbook-sync', { body: {} });
    if (!error && (data as { purchased?: boolean })?.purchased) return true;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return false;
}

/** Called after a successful purchase or restore in the store. */
export function unlockAfterPurchase() {
  set({ purchased: true });
  syncPurchase().catch(() => {});
}
