import { useEffect, useRef } from 'react';
import { usePathname, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/lib/session';
import { nextOnboardingRoute } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';

const PUBLIC = ['/', '/language', '/signin', '/signup', '/forgot', '/confirmation', '/captcha', '/invite-not-found', '/legal', '/community-rules', '/support-help', '/not-found', '/safety'];
// Account controls stay reachable with an unfinished profile (deletion and data export must always be available).
const ACCOUNT_OK = ['/profile', '/media-viewer', '/settings', '/delete-account', '/delete-confirm', '/data-export', '/privacy-data', '/legal', '/support-help', '/community-rules', '/safety', '/language'];
const ONBOARDING_OK = (p: string) => p.startsWith('/admin') || p.startsWith('/ob-') || p.startsWith('/verification-') || ACCOUNT_OK.includes(p);
const RESTRICTED_OK = ['/appeal', '/support-help', '/data-export', '/report-status', '/legal', '/community-rules', '/account-suspended', '/account-banned', '/account-warning', '/settings'];
const SEEN = 'renvi.seenWarning';

export const isBanned = (p: Record<string, any> | null) => p?.suspended_until === 'infinity' || (p?.suspended_until && new Date(p.suspended_until).getFullYear() > 9000);
export const isSuspended = (p: Record<string, any> | null) => !!p?.suspended_until && !isBanned(p) && new Date(p.suspended_until) > new Date();

// Route guard: sign-in → finished profile → account restrictions.
export function Gate() {
  const { ready, configured, session, profile } = useSession();
  const path = usePathname();
  const warned = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !configured) return;
    const isPublic = PUBLIC.includes(path) || path.startsWith('/invite/');
    if (!session) { if (!isPublic) router.replace('/'); return; }
    if (isBanned(profile)) { if (!RESTRICTED_OK.includes(path)) router.replace('/account-banned'); return; }
    if (isSuspended(profile)) { if (!RESTRICTED_OK.includes(path)) router.replace('/account-suspended'); return; }
    if (!profile?.onboarding_done && !isPublic && !ONBOARDING_OK(path)) { router.replace(nextOnboardingRoute(profile) as never); return; }
  }, [ready, configured, session, profile, path]);

  // A new warning from moderation is shown once.
  useEffect(() => {
    if (!session || warned.current === session.user.id) return;
    warned.current = session.user.id;
    supabase.from('account_sanctions').select('id, kind').eq('kind', 'warning').order('created_at', { ascending: false }).limit(1)
      .then(async ({ data }) => {
        const w = data?.[0];
        if (!w) return;
        const seen = await AsyncStorage.getItem(SEEN).catch(() => null);
        if (seen !== w.id) { await AsyncStorage.setItem(SEEN, w.id).catch(() => {}); router.push('/account-warning'); }
      });
  }, [session]);

  return null;
}
