import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/lib/session';
import { gateTarget } from '@/lib/gateRoutes';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

export { isBanned, isSuspended } from '@/lib/gateRoutes';

const SEEN = 'renvi.seenWarning';

// Route guard: sign-in → finished profile → account restrictions (rules live in lib/gateRoutes.ts).
export function Gate() {
  const { ready, configured, session, profile, loadError, refresh } = useSession();
  const { t } = useLang();
  const path = usePathname();
  const warned = useRef<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!ready || !configured) return;
    const to = gateTarget(path, !!session, profile, loadError);
    if (to) router.replace(to as never);
  }, [ready, configured, session, profile, loadError, path]);

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

  // Profile / plan could not be loaded: keep the last good state and offer a retry instead of acting on missing data.
  if (!session || !loadError) return null;
  const retry = async () => { setRetrying(true); try { await refresh(); } finally { setRetrying(false); } };
  return (
    <View style={s.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={s.text}>{profile ? t('client.loadError.banner') : t('client.loadError.bannerEmpty')}</Text>
      <Pressable accessibilityRole="button" disabled={retrying} onPress={retry} style={s.btn}>
        <Text style={s.btnText}>{retrying ? t('common.loading') : t('client.loadError.retry')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { position: 'absolute', left: 12, right: 12, bottom: 78, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.ink, },
  text: { flex: 1, color: '#fff', fontSize: 12, lineHeight: 17 },
  btn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
