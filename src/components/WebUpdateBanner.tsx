import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// Web only. The deploy workflow bakes the commit into the bundle (EXPO_PUBLIC_BUILD_SHA)
// and publishes the same commit in version.json. When a newer build is live, an open tab
// offers a reload, so people never keep using an outdated version.
const BUILD = process.env.EXPO_PUBLIC_BUILD_SHA ?? '';
const BASE = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
const EVERY_MS = 5 * 60 * 1000;

export async function fetchLiveCommit(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(`${BASE}/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { commit?: unknown };
    return typeof body.commit === 'string' ? body.commit : null;
  } catch {
    return null;
  }
}

export function WebUpdateBanner() {
  const { t } = useLang();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !BUILD) return;
    let alive = true;
    const check = async () => {
      const live = await fetchLiveCommit();
      if (alive && live && live !== BUILD) setStale(true);
    };
    check();
    const id = setInterval(check, EVERY_MS);
    const onFocus = () => { check(); };
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, []);

  if (!stale) return null;
  return (
    <View style={s.bar} accessibilityRole="alert">
      <Text style={s.text}>{t('web.updateAvailable')}</Text>
      <Pressable accessibilityRole="button" onPress={() => window.location.reload()} style={s.btn}>
        <Text style={s.btnText}>{t('web.reload')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 1000,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.ink, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
  },
  text: { flex: 1, color: colors.white, fontSize: 14 },
  btn: { backgroundColor: colors.red, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 14 },
  btnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
