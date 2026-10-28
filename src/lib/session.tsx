// Session, own profile and tier. The tier is read from the server; the client never sets it.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isBackendConfigured } from './supabase';
import { api } from './api';
import { initPurchases } from './purchases';
import { useLang } from './lang';

export type Tier = 'free' | 'plus' | 'premium';
export type Profile = Record<string, any> | null;

type Ctx = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  profile: Profile;
  tier: Tier;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionCtx = createContext<Ctx>({
  ready: false, configured: isBackendConfigured, session: null, profile: null, tier: 'free',
  refresh: async () => {}, signOut: async () => {},
});

type Snapshot = { session: Session | null; profile: Profile; tier: Tier };

// Reads session, own profile and the server-side plan in one go.
async function loadSnapshot(): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { session: null, profile: null, tier: 'free' };
  initPurchases(data.session.user.id).catch(() => {});
  try {
    const profile = await api.myProfile();
    const sub = await api.subscription(data.session.user.id);
    const active = !sub.expires_at || new Date(sub.expires_at) > new Date();
    return { session: data.session, profile, tier: active ? (sub.tier as Tier) : 'free' };
  } catch {
    // Keep the session; screens show their own error states.
    return { session: data.session, profile: null, tier: 'free' };
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isBackendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [tier, setTier] = useState<Tier>('free');

  const { applyProfileLang } = useLang();

  const apply = useCallback((s: Snapshot) => {
    setSession(s.session); setProfile(s.profile); setTier(s.tier);
    if (s.profile?.language) applyProfileLang(s.profile.language);
  }, [applyProfileLang]);
  const refresh = useCallback(async () => { apply(await loadSnapshot()); }, [apply]);

  useEffect(() => {
    if (!isBackendConfigured) return;
    loadSnapshot().then(apply).finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); refresh(); });
    return () => data.subscription.unsubscribe();
  }, [apply, refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setTier('free');
  }, []);

  return (
    <SessionCtx.Provider value={{ ready, configured: isBackendConfigured, session, profile, tier, refresh, signOut }}>
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
