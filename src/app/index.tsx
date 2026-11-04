import { useEffect } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { Btn, LinkBtn, Screen, Tiny } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { useSession } from '@/lib/session';
import { LANGUAGE_NAMES, useLang } from '@/lib/lang';
import { nextOnboardingRoute, welcomeHold } from '@/lib/onboarding';
import { welcomeTarget } from '@/lib/gateRoutes';

// 01 · Обложка (welcome)
export default function Welcome() {
  const { ready, session, profile, loadError } = useSession();
  const { lang, t } = useLang();

  useEffect(() => {
    if (!ready || !session) return;
    // Finished profile -> Discover. Unfinished (or a brand-new confirmed account) -> its onboarding step: "/" is never
    // a dead end in the middle of the profile. Only "save draft and leave" keeps the welcome screen (welcomeHold).
    const to = welcomeTarget(true, profile, loadError, !!session.user.email_confirmed_at, welcomeHold.on);
    if (to) router.replace(to as never);
  }, [ready, session, profile, loadError]);

  // A different person signing in later must not inherit the previous "save draft and leave".
  useEffect(() => { if (ready && !session) welcomeHold.on = false; }, [ready, session]);

  // Web: when Auth falls back to the Site URL (redirect not allow-listed) the confirmation tokens land on the home
  // page. Hand them to the callback screen instead of silently dropping them.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const { hash, search, pathname } = window.location;
    if (/access_token=|error_description=/.test(hash) || /[?&](token_hash|code)=/.test(search)) {
      window.location.replace(`${pathname.replace(/\/+$/, '')}/auth-callback${search}${hash}`);
    }
  }, []);

  const draft = session && profile && !profile.onboarding_done ? nextOnboardingRoute(profile) : null;
  // Signed in with a finished profile: the redirect above is on its way, do not flash the sign-up screen.
  if (ready && session && profile?.onboarding_done) return <Screen><View /></Screen>;

  return (
    <Screen>
      {draft ? <Btn kind="secondary" label={t('screens.index.prodolzhitAnketu')} onPress={() => { welcomeHold.on = false; router.push(draft as never); }} /> : null}
      <View style={s.brandRow}>
        <BrandMark size={55} />
        <Text style={s.wordmark}>renvi</Text>
      </View>
      <Text style={s.heading} accessibilityRole="header">{t('screens.index.pustBudetVzaimno')}</Text>
      <Text style={s.lede}>{t('screens.index.nachniteSTogoChto')}</Text>
      <Image
        resizeMode="cover"
        source={require('@/assets/images/welcome-hero.png')}
        style={s.hero}
        accessibilityLabel={t('screens.index.vymyshlennayaVzroslayaPara')}
      />
      <Text style={s.signoff}>{t('screens.index.makeItMutualZnakomstva')}</Text>
      <Btn label={t('screens.index.nachatZnakomstvo')} onPress={() => router.push('/signup')} />
      <Btn kind="secondary" label={t('screens.index.uMenyaUzheEst')} onPress={() => router.push('/signin')} />
      <LinkBtn center label={t('screens.index.vIzmenitYazyk', { language: LANGUAGE_NAMES[lang] })} onPress={() => router.push('/language')} />
      <Tiny center>{t('screens.index.sozdavayaAkkauntVyOtdelno')}</Tiny>
    </Screen>
  );
}

const s = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 19 },
  wordmark: { fontSize: 53, fontWeight: '900', letterSpacing: -4, color: colors.ink },
  heading: { fontSize: 43, fontWeight: '900', lineHeight: 41, letterSpacing: -2.8, maxWidth: 330, color: colors.ink },
  lede: { fontSize: 13, lineHeight: 20, color: colors.sub, marginTop: 10, marginBottom: 10 },
  hero: { width: '100%', height: 205, borderRadius: 17, marginVertical: 17 },
  signoff: { fontSize: 10, letterSpacing: 0.7, color: colors.sub, textAlign: 'center', marginVertical: 12 },
});
