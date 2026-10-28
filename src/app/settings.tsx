import { Linking, Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, CheckRow, Eyebrow, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { LANGUAGE_NAMES, useLang } from '@/lib/lang';
import { api, type Lang } from '@/lib/api';
import { usePrefs } from '@/hooks/usePrefs';
import { useSession } from '@/lib/session';
import type { Prefs } from '@/lib/account';

const NOTIF: [keyof Prefs, string][] = [['messages', 'Новые сообщения'], ['matches', 'Совпадения'], ['dates', 'Приглашения на свидание'], ['news', 'Подсказки и новости']];

// 70 · Язык и доступность
export default function Settings() {
  const toast = useToast();
  const { lang, setLang } = useLang();
  const { prefs, set } = usePrefs();
  const { signOut } = useSession();
  const pick = (l: Lang) => { setLang(l); api.saveOnboarding({ language: l }).catch(() => {}); };
  const toggle = (k: keyof Prefs) => set(k, !prefs[k]).catch(() => toast('Не удалось сохранить'));
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker="НАСТРОЙКИ" heading="Ваш RENVI" sub="Язык, уведомления и доступность без лишних шагов." />
      <Card tight>
        <Eyebrow>ЯЗЫК ПРИЛОЖЕНИЯ</Eyebrow>
        {(Object.keys(LANGUAGE_NAMES) as Lang[]).map((k) => <Row key={k} label={LANGUAGE_NAMES[k]} onPress={() => pick(k)} right={lang === k ? '✓' : '○'} />)}
      </Card>
      <Card tight>
        <Eyebrow>УВЕДОМЛЕНИЯ</Eyebrow>
        {NOTIF.map(([k, n]) => <CheckRow key={k} on={prefs[k]} onPress={() => toggle(k)}><Text style={{ fontSize: 12 }}>{n}</Text></CheckRow>)}
        <Row label="Все настройки уведомлений" onPress={() => router.push('/notification-settings')} />
      </Card>
      <Card tight>
        <Eyebrow>ДОСТУПНОСТЬ</Eyebrow>
        <CheckRow on={prefs.reduce_motion} onPress={() => toggle('reduce_motion')}><Text style={{ fontSize: 12 }}>Уменьшить анимации</Text></CheckRow>
        <CheckRow on={prefs.larger_text} onPress={() => toggle('larger_text')}><Text style={{ fontSize: 12 }}>Более крупный текст</Text></CheckRow>
        <Tiny>Приложение также учитывает Reduce Motion и размер текста в настройках iOS.</Tiny>
      </Card>
      <Btn kind="ghost" label="Открыть уведомления iOS" onPress={() => Linking.openSettings().catch(() => toast('Откройте настройки телефона вручную'))} />
      <Btn kind="ghost" label="Выйти из аккаунта" onPress={async () => { await signOut(); router.replace('/'); }} />
    </Screen>
  );
}
