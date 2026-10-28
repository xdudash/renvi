import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Loading, SafeBanner, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDateRow } from '@/hooks/useDate';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { DATE_PLACES } from '@/lib/catalog';
import { resetDateDraft } from '@/lib/dateDraft';

// 59 · Входящее приглашение · ответ
export default function DateIncoming() {
  const { match, date } = useLocalSearchParams<{ match: string; date: string }>();
  const toast = useToast();
  const d = useDateRow(date);
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const [busy, setBusy] = useState(false);
  const respond = async (action: 'accept' | 'decline') => {
    setBusy(true);
    try {
      await api.respondDate(date, action);
      router.replace({ pathname: action === 'accept' ? '/date-accepted' : '/date-declined', params: { match, date } });
    } catch { toast('Не удалось ответить'); } finally { setBusy(false); }
  };
  if (d.loading || ctx.loading) return <Screen tabs="chats"><BackLink /><Loading /></Screen>;
  const icon = DATE_PLACES.find((p) => p.key === d.data?.place_key)?.icon ?? '☕';
  return (
    <Screen tabs="chats">
      <BackLink onPress={() => router.replace({ pathname: '/chat', params: { match } })} />
      <Title kicker="ПРИГЛАШЕНИЕ" heading={`${ctx.data?.partner.name ?? ''} предлагает встретиться`} sub="Вы можете принять план, предложить другое время или отказаться." />
      <Card>
        <Chip label="ЖДЁТ ВАШЕГО ОТВЕТА" tone="amber" />
        <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -1, marginTop: 10 }}>{icon} {d.place} · {d.day.toLowerCase()}</Text>
        <Tiny>Публичное место · {d.time}</Tiny>
        {d.data?.note ? <Text style={{ fontSize: 12, marginTop: 8 }}>«{d.data.note}»</Text> : null}
      </Card>
      <Btn label="Принять приглашение" busy={busy} onPress={() => respond('accept')} />
      <Btn kind="secondary" label="Предложить другое время" onPress={async () => {
        try { await api.respondDate(date, 'decline'); } catch {}
        resetDateDraft(match);
        router.replace({ pathname: '/date-create', params: { match } });
      }} />
      <Btn kind="ghost" label="Вежливо отказаться" disabled={busy} onPress={() => respond('decline')} />
      <SafeBanner>Вы не обязаны объяснять отказ. Организуйте собственную дорогу до места встречи.</SafeBanner>
    </Screen>
  );
}
