import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { planRecovery } from './recovery';

/**
 * Where the recovery e-mail sends the user. Native: renvi://reset-password (Linking.createURL gives exp://… in
 * Expo Go, which must also be listed in Auth → Redirect URLs). Web: <origin><base path>/reset-password.
 */
export function recoveryRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // The web build may live under a sub-path (GitHub Pages: /renvi), set by the deploy workflow.
    const base = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
    return `${window.location.origin}${base}/reset-password`;
  }
  return Linking.createURL('/reset-password');
}

/**
 * Turns the link the user opened into a (recovery) session. supabase.ts has detectSessionInUrl: false, so this is the
 * only place that consumes the credentials. Resolves true when a session is established.
 */
export function establishRecoverySession(url: string | null): Promise<boolean> {
  // A code / token can be used once: remount or StrictMode re-runs must share the first attempt.
  if (!url) return establish(url);
  const key = url;
  const hit = attempts.get(key);
  if (hit) return hit;
  const p = establish(url);
  attempts.set(key, p);
  p.then((ok) => { if (!ok) attempts.delete(key); }, () => attempts.delete(key));
  return p;
}
const attempts = new Map<string, Promise<boolean>>();

async function establish(url: string | null): Promise<boolean> {
  const plan = planRecovery(url);
  switch (plan.kind) {
    case 'exchange': {
      const { error } = await supabase.auth.exchangeCodeForSession(plan.code);
      return !error;
    }
    case 'verify': {
      const { error } = await supabase.auth.verifyOtp({ token_hash: plan.tokenHash, type: 'recovery' });
      return !error;
    }
    case 'setSession': {
      const { error } = await supabase.auth.setSession({ access_token: plan.accessToken, refresh_token: plan.refreshToken });
      return !error;
    }
    case 'none': {
      // Opened without credentials: fine only if the user is already signed in (e.g. the code was consumed on first render).
      const { data } = await supabase.auth.getSession();
      return !!data.session;
    }
    default:
      return false;
  }
}
