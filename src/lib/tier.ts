// The signed-in person's tier and limits (Free / Plus, sparks left, rewarded ads left, free boost). The server
// (my_tier(), migration 0039) is the source of truth; this is a small shared store so every screen sees the same
// numbers after a purchase or a watched ad.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api, type Tier } from './api';
import { onUserReset } from './userState';
import { initPurchases, purchasesAvailable, syncPlus } from './purchases';
import { toAppError, type AppError } from './errors';
import { useSession } from './session';

type State = { uid: string | null; tier: Tier | null; error: AppError | null; loading: boolean };
const EMPTY: State = { uid: null, tier: null, error: null, loading: false };
let state: State = EMPTY;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
onUserReset(() => { state = EMPTY; synced = null; listeners.forEach((l) => l()); });

let inflight: Promise<Tier | null> | null = null;
let synced: string | null = null;

/** Reloads the tier. Once per user (and day) it first asks the store/server to re-read renewals and expiry. */
export function refreshTier(uid: string): Promise<Tier | null> {
  if (inflight && state.uid === uid) return inflight;
  if (state.uid !== uid) state = { ...EMPTY, uid };
  set({ loading: true });
  inflight = (async () => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if (synced !== `${uid}:${day}` && purchasesAvailable()) {
        synced = `${uid}:${day}`;
        await initPurchases(uid).catch(() => {});
        await syncPlus(1).catch(() => null);
      }
      const tier = await api.myTier();
      if (state.uid === uid) set({ tier, error: null, loading: false });
      return tier;
    } catch (e) {
      if (state.uid === uid) set({ error: toAppError(e), loading: false });
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Puts a fresh tier (from a server reply) into the store. */
export function setTier(uid: string, tier: Tier) { if (state.uid === uid) set({ tier, error: null }); }

export function useTier(uid: string | null | undefined) {
  const snap = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
  useEffect(() => { if (uid && (state.uid !== uid || (!state.tier && !state.loading && !state.error))) refreshTier(uid); }, [uid]);
  const reload = useCallback(() => { if (uid) refreshTier(uid); }, [uid]);
  const mine = snap.uid === uid;
  return { tier: mine ? snap.tier : null, loading: !mine || snap.loading, error: mine ? snap.error : null, reload };
}

/** The tier of the signed-in person. */
export function useMyTier() {
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  return { uid, ...useTier(uid) };
}

/** Sparks the person may send today: Infinity for Plus, otherwise the server's limit (base + watched ads). */
export function useSparkLimit(): number {
  const { tier } = useMyTier();
  if (!tier) return 20;
  return tier.spark_limit === null ? Infinity : tier.spark_limit;
}
