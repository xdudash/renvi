import { useEffect } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { Btn, LinkBtn, Screen, Tiny } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { useSession } from '@/lib/session';
import { LANGUAGE_NAMES, useLang } from '@/lib/lang';
import { nextOnboardingRoute } from '@/lib/onboarding';

// 01 · Обложка (welcome)
export default function Welcome() {
  const { ready, session, profile, loadError } = useSession();
  const { lang, t } = useLang();

  useEffect(() => {
    if (!ready || !session) return;
    if (profile?.onboarding_done) router.replace('/discover');
    // A new account has no profile row until the first onboarding step. Once the e-mail is confirmed (sign-in or the
    // link from the letter) it goes straight to that step, as signup did before confirmation was required. Without
    // this the welcome screen showed only "sign up / sign in" and signing in returned here in a loop.
    else if (!profile && !loadError && session.user.email_confirmed_at) router.replace(nextOnboardingRoute(null) as never);
  }, [ready, session, profile, loadError]);

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

  return (
    <Screen>
      {draft ? <Btn kind="secondary" label={t('screens.index.prodolzhitAnketu')} onPress={() => router.push(draft as never)} /> : null}
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
