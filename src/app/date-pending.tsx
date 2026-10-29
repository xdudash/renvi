import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Loading, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Ticket } from '@/components/Ticket';
import { useDateRow } from '@/hooks/useDate';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { VideoCallButton } from '@/components/VideoCallButton';
import { useSession } from '@/lib/session';
import { dateView } from '@/lib/dateStatus';

// 58 · Приглашение отправлено
export default function DatePending() {
  const { t } = useLang();
  const { match, date } = useLocalSearchParams<{ match: string; date: string }>();
  const toast = useToast();
  const d = useDateRow(date);
  const { session } = useSession();
  // Show the invitation as it is now (it may have been accepted, declined or cancelled meanwhile).
  const v = dateView(d.data?.status, d.data ? d.data.proposer_id === session?.user.id : true);
  const [busy, setBusy] = useState(false);
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker={t('screens.datePending.kicker')} heading={t('screens.datePending.heading')} sub={t('screens.datePending.sub')} />
      {d.loading ? <Loading /> : <Ticket place={d.place} day={d.day} time={d.time} status={t(v.chipKey)} tone={v.tone} />}
      <Tiny>{t('screens.datePending.note')}</Tiny>
      <Btn kind="primary" label={t('screens.datePending.viewChat')} onPress={toChat} />
      <VideoCallButton match={match} />
      {v.canCancel ? <Btn kind="ghost" label={t('screens.datePending.cancel')} busy={busy} onPress={async () => {
        setBusy(true);
        try { await api.cancelDate(date); router.replace({ pathname: '/date-cancelled', params: { match } }); } catch { toast(t('screens.datePending.cancelFailed')); } finally { setBusy(false); }
      }} /> : null}
    </Screen>
  );
}
