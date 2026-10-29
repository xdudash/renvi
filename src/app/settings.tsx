import { Linking, Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, CheckRow, Eyebrow, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { LANGUAGE_NAMES, useLang } from '@/lib/lang';
import { api, type Lang } from '@/lib/api';
import { usePrefs } from '@/hooks/usePrefs';
import { useSession } from '@/lib/session';
import type { Prefs } from '@/lib/account';

const NOTIF = [['messages', 'screens.settings.notifMessages'], ['matches', 'screens.settings.notifMatches'], ['dates', 'screens.settings.notifDates'], ['news', 'screens.settings.notifNews']] as const;

// 70 · Язык и доступность
export default function Settings() {
  const toast = useToast();
  const { lang, setLang, t } = useLang();
  const { prefs, set } = usePrefs();
  const { signOut } = useSession();
  const pick = (l: Lang) => { setLang(l); api.saveOnboarding({ language: l }).catch(() => {}); };
  const toggle = (k: keyof Prefs) => set(k, !prefs[k]).catch(() => toast(t('screens.settings.saveFailed')));
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker={t('screens.settings.kicker')} heading={t('screens.settings.heading')} sub={t('screens.settings.sub')} />
      <Card tight>
        <Eyebrow>{t('screens.settings.language')}</Eyebrow>
        {(Object.keys(LANGUAGE_NAMES) as Lang[]).map((k) => <Row key={k} label={LANGUAGE_NAMES[k]} onPress={() => pick(k)} right={lang === k ? '✓' : '○'} />)}
      </Card>
      <Card tight>
        <Eyebrow>{t('screens.settings.notifications')}</Eyebrow>
        {NOTIF.map(([k, n]) => <CheckRow key={k} on={prefs[k]} onPress={() => toggle(k)}><Text style={{ fontSize: 12 }}>{t(n)}</Text></CheckRow>)}
        <Row label={t('screens.settings.allNotifications')} onPress={() => router.push('/notification-settings')} />
      </Card>
      <Card tight>
        <Eyebrow>{t('screens.settings.accessibility')}</Eyebrow>
        <CheckRow on={prefs.reduce_motion} onPress={() => toggle('reduce_motion')}><Text style={{ fontSize: 12 }}>{t('screens.settings.reduceMotion')}</Text></CheckRow>
        <CheckRow on={prefs.larger_text} onPress={() => toggle('larger_text')}><Text style={{ fontSize: 12 }}>{t('screens.settings.largerText')}</Text></CheckRow>
        <Tiny>{t('screens.settings.iosNote')}</Tiny>
      </Card>
      {/* App Review 5.1.1(v): account deletion must be easy to find from settings, not only via Privacy. */}
      <Card tight>
        <Row label={t('screens.me.rowPrivacy')} sub={t('screens.me.rowPrivacySub')} onPress={() => router.push('/privacy-data')} />
        <Row label={t('screens.privacyData.udalitAkkaunt')} sub={t('screens.privacyData.udalenieBezPovtornogoPredl')} onPress={() => router.push('/delete-account')} />
      </Card>
      <Btn kind="ghost" label={t('screens.settings.openIos')} onPress={() => Linking.openSettings().catch(() => toast(t('screens.settings.openManually')))} />
      <Btn kind="ghost" label={t('screens.settings.signOut')} onPress={async () => { await signOut(); router.replace('/'); }} />
    </Screen>
  );
}
