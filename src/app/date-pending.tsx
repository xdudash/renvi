import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Loading, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Ticket } from '@/components/Ticket';
import { useDateRow } from '@/hooks/useDate';
import { api } from '@/lib/api';

// 58 · Приглашение отправлено
export default function DatePending() {
  const { match, date } = useLocalSearchParams<{ match: string; date: string }>();
  const toast = useToast();
  const d = useDateRow(date);
  const [busy, setBusy] = useState(false);
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker="ПРИГЛАШЕНИЕ ОТПРАВЛЕНО" heading="Предложение отправлено" sub="В приглашении видно только публичное место и предложенное время." />
      {d.loading ? <Loading /> : <Ticket place={d.place} day={d.day} time={d.time} status="ОЖИДАЕТ ОТВЕТА" tone="amber" />}
      <Tiny>Можно принять, предложить другое время или отказаться.</Tiny>
      <Btn kind="primary" label="Посмотреть диалог" onPress={toChat} />
      <Btn kind="ghost" label="Отменить приглашение" busy={busy} onPress={async () => {
        setBusy(true);
        try { await api.cancelDate(date); router.replace({ pathname: '/date-cancelled', params: { match } }); } catch { toast('Не удалось отменить'); } finally { setBusy(false); }
      }} />
    </Screen>
  );
}
