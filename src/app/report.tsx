import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Choice, Field, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/catalog';
import { useLang } from '@/lib/lang';

// 86 · Пожаловаться
export default function Report() {
  const { t } = useLang();
  const { profile, message, reason: preset } = useLocalSearchParams<{ profile?: string; message?: string; reason?: string }>();
  const toast = useToast();
  const [reason, setReason] = useState<string>(preset ?? 'fake');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!profile && !message) { toast(t('screens.report.openFrom')); return; }
    setBusy(true);
    try {
      const r = await api.report(profile || null, message || null, reason, details.trim() || null);
      router.replace({ pathname: '/report-status', params: { id: r.id } });
    } catch { toast(t('screens.report.failed')); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.report.kicker')} heading={t('screens.report.heading')} sub={t('screens.report.sub')} />
      {REPORT_REASONS.map(([k, n]) => (
        <Choice key={k} selected={reason === k} onPress={() => setReason(k)}><Text style={{ fontSize: 12, flex: 1 }}>{t(n)}</Text><Text>{reason === k ? '◉' : '○'}</Text></Choice>
      ))}
      <Field value={details} onChangeText={setDetails} multiline maxLength={1000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.report.detailsPlaceholder')} />
      <Tiny>{t('screens.report.note')}</Tiny>
      <Btn label={t('screens.report.send')} busy={busy} onPress={submit} />
      <Btn kind="ghost" label={t('screens.report.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}
