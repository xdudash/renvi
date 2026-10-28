// Session, own profile and tier. The tier is read from the server; the client never sets it.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isBackendConfigured } from './supabase';
import { api } from './api';
import { initPurchases } from './purchases';
import { useLang } from './lang';
import { mergeSnapshot, type Held, type Loaded, type Tier } from './snapshot';
import { unlinkPush } from './push';
import { resetUserState } from './userState';

export type { Tier };
export type Profile = Record<string, any> | null;

type Ctx = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  profile: Profile;
  tier: Tier;
  /** True when the last profile/plan load failed. The last good profile (same account) is kept meanwhile. */
  loadError: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionCtx = createContext<Ctx>({
  ready: false, configured: isBackendConfigured, session: null, profile: null, tier: 'free', loadError: false,
  refresh: async () => {}, signOut: async () => {},
});

type Snapshot = { session: Session | null; loaded: Loaded };

// Reads session, own profile and the server-side plan in one go. A part that fails stays undefined, never null.
async function loadSnapshot(): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return { session: null, loaded: { userId: null, failed: false } };
  initPurchases(session.user.id).catch(() => {});
  const loaded: Loaded = { userId: session.user.id, failed: false };
  try { loaded.profile = await api.myProfile(); } catch { loaded.failed = true; }
  try {
    const sub = await api.subscription(session.user.id);
    const active = !sub.expires_at || new Date(sub.expires_at) > new Date();
    loaded.tier = active ? (sub.tier as Tier) : 'free';
  } catch { loaded.failed = true; }
  return { session, loaded };
}

const TIMEOUT = Symbol('timeout');
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), ms))]);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isBackendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [tier, setTier] = useState<Tier>('free');
  const [loadError, setLoadError] = useState(false);
  const held = useRef<Held>({ userId: null, profile: null, tier: 'free' });

  const { applyProfileLang } = useLang();

  const apply = useCallback((s: Snapshot) => {
    const m = mergeSnapshot(held.current, s.loaded);
    held.current = { userId: m.userId, profile: m.profile, tier: m.tier };
    setSession(s.session); setProfile(m.profile); setTier(m.tier); setLoadError(m.loadError);
    if (m.profile?.language) applyProfileLang(m.profile.language);
  }, [applyProfileLang]);
  const seq = useRef(0);
  // Only the newest load is applied, so a slow older response cannot overwrite fresher state.
  const refresh = useCallback(async () => {
    const id = ++seq.current;
    const snap = await loadSnapshot();
    if (id === seq.current) apply(snap);
  }, [apply]);

  useEffect(() => {
    if (!isBackendConfigured) return;
    refresh().finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // A different account must never see the previous account's profile while its own loads.
      if ((s?.user.id ?? null) !== held.current.userId) {
        held.current = { userId: null, profile: null, tier: 'free' };
        setProfile(null); setTier('free');
      }
      refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [apply, refresh]);

  // Per-user client state (drafts, date draft, ...) is dropped whenever the account changes.
  const uid = session?.user.id ?? null;
  const lastUid = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastUid.current !== undefined && lastUid.current !== uid) resetUserState();
    lastUid.current = uid;
  }, [uid]);

  const signOut = useCallback(async () => {
    // Unlink this device's push token while still authenticated; never block sign-out for long when offline.
    const id = held.current.userId;
    if (id) await withTimeout(unlinkPush(id), 4000).catch(() => {});
    await supabase.auth.signOut();
    held.current = { userId: null, profile: null, tier: 'free' };
    setSession(null); setProfile(null); setTier('free'); setLoadError(false);
    resetUserState();
  }, []);

  return (
    <SessionCtx.Provider value={{ ready, configured: isBackendConfigured, session, profile, tier, loadError, refresh, signOut }}>
      {children}
    </SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);

// Daily like limit comes from server configuration (app_config.tier_limits).
export function useTierLimits() {
  const { tier } = useSession();
  const [limits, setLimits] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    api.config<Record<string, any>>('tier_limits').then(setLimits).catch(() => setLimits(null));
  }, []);
  return { tier, limits: limits?.[tier] ?? null };
}
