import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Loading, SafeBanner, Screen, Title, useToast } from '@/components/ui';
import { Ticket } from '@/components/Ticket';
import { useDateRow } from '@/hooks/useDate';
import { api } from '@/lib/api';
import { resetDateDraft } from '@/lib/dateDraft';

// 60 · Принято
export default function DateAccepted() {
  const { match, date } = useLocalSearchParams<{ match: string; date: string }>();
  const toast = useToast();
  const d = useDateRow(date);
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker="ПЛАН ПОДТВЕРЖДЁН" heading="До встречи — немного" sub="План можно открыть в диалоге и отменить, если ваши планы изменились." />
      {d.loading ? <Loading /> : <Ticket place={d.place} day={d.day} time={d.time} status="ПРИНЯТО" tone="green" />}
      <SafeBanner>Сообщите близкому, где и с кем встречаетесь. Первая встреча — в публичном месте.</SafeBanner>
      <Btn label="Вернуться в чат" onPress={toChat} />
      <Btn kind="ghost" label="Изменить план" onPress={async () => {
        try { await api.cancelDate(date); } catch { toast('Не удалось изменить план'); return; }
        resetDateDraft(match);
        router.replace({ pathname: '/date-create', params: { match } });
      }} />
    </Screen>
  );
}
