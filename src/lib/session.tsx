// Session and own profile. RENVI is free for everyone: there are no plans, tiers or purchases.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isBackendConfigured } from './supabase';
import { api } from './api';
import { useLang } from './lang';
import { mergeSnapshot, type Held, type Loaded } from './snapshot';
import { unlinkPush } from './push';
import { resetUserState } from './userState';

export type Profile = Record<string, any> | null;

type Ctx = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  profile: Profile;
  /** True when the last profile load failed. The last good profile (same account) is kept meanwhile. */
  loadError: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionCtx = createContext<Ctx>({
  ready: false, configured: isBackendConfigured, session: null, profile: null, loadError: false,
  refresh: async () => {}, signOut: async () => {},
});

type Snapshot = { session: Session | null; loaded: Loaded };

// Reads session and own profile in one go. A profile that fails to load stays undefined, never null.
async function loadSnapshot(): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return { session: null, loaded: { userId: null, failed: false } };
  const loaded: Loaded = { userId: session.user.id, failed: false };
  try { loaded.profile = await api.myProfile(session.user.id); } catch { loaded.failed = true; }
  return { session, loaded };
}

const TIMEOUT = Symbol('timeout');
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), ms))]);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isBackendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loadError, setLoadError] = useState(false);
  const held = useRef<Held>({ userId: null, profile: null });

  const { applyProfileLang } = useLang();

  const apply = useCallback((s: Snapshot) => {
    const m = mergeSnapshot(held.current, s.loaded);
    held.current = { userId: m.userId, profile: m.profile };
    setSession(s.session); setProfile(m.profile); setLoadError(m.loadError);
    if (m.profile?.language) applyProfileLang(m.profile.language);
  }, [applyProfileLang]);
  const seq = useRef(0);
  // Only the newest load is applied, so a slow older response cannot overwrite fresher state.
  // `ready` means the newest load for the current account has been applied. It must not turn true when an
  // older, discarded load finishes: the gate would then see "signed in, no profile" and send an existing
  // user to onboarding (race between the first load and the INITIAL_SESSION auth event).
  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const snap = await loadSnapshot();
      if (id === seq.current) apply(snap);
    } finally {
      if (id === seq.current) setReady(true);
    }
  }, [apply]);

  useEffect(() => {
    if (!isBackendConfigured) return;
    refresh();
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // A different account must never see the previous account's profile while its own loads.
      if ((s?.user.id ?? null) !== held.current.userId) {
        held.current = { userId: null, profile: null };
        setProfile(null);
        setReady(false); // the gate waits for this account's own profile before routing
      }
      refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [apply, refresh]);

  // Per-user client state (drafts, date draft, ...) is dropped whenever the account changes.
  const uid = session?.user.id ?? null;
  const lastUid = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Reset on sign-out or a switch to another account — not when the session first appears (null → id on
    // page load), which would wipe drafts a screen has just filled (e.g. the date invitation draft).
    if (lastUid.current && lastUid.current !== uid) resetUserState();
    lastUid.current = uid;
  }, [uid]);

  const signOut = useCallback(async () => {
    // Unlink this device's push token while still authenticated; never block sign-out for long when offline.
    const id = held.current.userId;
    if (id) await withTimeout(unlinkPush(id), 4000).catch(() => {});
    await supabase.auth.signOut();
    held.current = { userId: null, profile: null };
    setSession(null); setProfile(null); setLoadError(false);
    resetUserState();
  }, []);

  return (
    <SessionCtx.Provider value={{ ready, configured: isBackendConfigured, session, profile, loadError, refresh, signOut }}>
      {children}
    </SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);

/** Fallback while app_config.daily_spark_limit is loading or unreadable; the server enforces the real value. */
export const DEFAULT_SPARK_LIMIT = 100;

// Anti-abuse daily spark limit, the same for everyone (app_config.daily_spark_limit, editable in the admin panel).
export function useSparkLimit(): number {
  const [limit, setLimit] = useState(DEFAULT_SPARK_LIMIT);
  useEffect(() => {
    let alive = true;
    api.config<number>('daily_spark_limit')
      .then((v) => { if (alive && typeof v === 'number' && v > 0) setLimit(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return limit;
}
