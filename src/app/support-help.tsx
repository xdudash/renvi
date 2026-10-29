import { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Field, Screen, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

const TOPICS = [['screens.supportHelp.topicSafety', '/safety'], ['screens.supportHelp.topicLogin', '/signin'], ['screens.supportHelp.topicPrivacy', '/privacy-data'], ['screens.supportHelp.topicMessages', '/support-share']] as const;

// 72 · Поддержка
export default function SupportHelp() {
  const { t } = useLang();
  const toast = useToast();
  const { session } = useSession();
  const [q, setQ] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  // Published moderation/support contact (App Review 1.2), set by the founder in admin → Настройки → Документы и поддержка.
  const supportEmail = useAsync(() => api.config<string | null>('support_email'), []);
  const email = typeof supportEmail.data === 'string' && supportEmail.data.includes('@') ? supportEmail.data : null;
  const list = useMemo(() => TOPICS.filter(([k]) => t(k).toLowerCase().includes(q.trim().toLowerCase())), [q, t]);
  const send = async () => {
    if (!session) { router.push('/signin'); return; }
    if (body.trim().length < 5) { toast(t('screens.supportHelp.describeMore')); return; }
    setBusy(true);
    try { await api.support('help', body.trim(), false); setBody(''); toast(t('screens.supportHelp.sent')); }
    catch { toast(t('screens.supportHelp.sendFailed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs={session ? 'me' : undefined}>
      <BackLink />
      <Title kicker={t('screens.supportHelp.kicker')} heading={t('screens.supportHelp.heading')} sub={t('screens.supportHelp.sub')} />
      <Field value={q} onChangeText={setQ} placeholder={t('screens.supportHelp.search')} accessibilityLabel={t('screens.supportHelp.search')} />
      <Card tight>{list.map(([k, r]) => <Row key={k} label={t(k)} onPress={() => router.push(r as never)} />)}</Card>
      <Field value={body} onChangeText={setBody} multiline maxLength={2000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.supportHelp.describe')} />
      <Btn label={t('screens.supportHelp.send')} busy={busy} onPress={send} />
      {email ? (
        <Card tight>
          <Row label={t('screens.supportHelp.emailUs')} sub={email} right="↗"
            onPress={() => Linking.openURL(`mailto:${email}`).catch(() => toast(t('screens.supportHelp.emailFailed', { email })))} />
        </Card>
      ) : null}
    </Screen>
  );
}
