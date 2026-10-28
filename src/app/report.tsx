import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Choice, Field, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/catalog';

// 86 · Пожаловаться
export default function Report() {
  const { profile, message, reason: preset } = useLocalSearchParams<{ profile?: string; message?: string; reason?: string }>();
  const toast = useToast();
  const [reason, setReason] = useState<string>(preset ?? 'fake');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!profile && !message) { toast('Откройте жалобу из профиля или сообщения'); return; }
    setBusy(true);
    try {
      const r = await api.report(profile || null, message || null, reason, details.trim() || null);
      router.replace({ pathname: '/report-status', params: { id: r.id } });
    } catch { toast('Не удалось отправить жалобу'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="СООБЩИТЬ" heading="Что произошло?" sub="Жалобу рассмотрит команда. Профиль не узнает, кто её отправил." />
      {REPORT_REASONS.map(([k, n]) => (
        <Choice key={k} selected={reason === k} onPress={() => setReason(k)}><Text style={{ fontSize: 12, flex: 1 }}>{n}</Text><Text>{reason === k ? '◉' : '○'}</Text></Choice>
      ))}
      <Field value={details} onChangeText={setDetails} multiline maxLength={1000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Дополнительные детали · не включайте чужие данные" />
      <Tiny>Вы получите подтверждение получения и результат рассмотрения. Если не согласны с решением, можно подать апелляцию.</Tiny>
      <Btn label="Отправить жалобу" busy={busy} onPress={submit} />
      <Btn kind="ghost" label="Отмена" onPress={() => router.back()} />
    </Screen>
  );
}
