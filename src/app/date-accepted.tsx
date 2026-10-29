import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Loading, SafeBanner, Screen, Title, useToast } from '@/components/ui';
import { Ticket } from '@/components/Ticket';
import { useDateRow } from '@/hooks/useDate';
import { api } from '@/lib/api';
import { resetDateDraft } from '@/lib/dateDraft';
import { useLang } from '@/lib/lang';
import { VideoCallButton } from '@/components/VideoCallButton';
import { useSession } from '@/lib/session';
import { dateView } from '@/lib/dateStatus';

// 60 · Принято
export default function DateAccepted() {
  const { t } = useLang();
  const { match, date } = useLocalSearchParams<{ match: string; date: string }>();
  const toast = useToast();
  const d = useDateRow(date);
  const { session } = useSession();
  const v = dateView(d.data?.status ?? 'accepted', d.data?.proposer_id === session?.user.id);
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker={t('screens.dateAccepted.planPodtverzhden')} heading={t('screens.dateAccepted.doVstrechiNemnogo')} sub={t('screens.dateAccepted.planMozhnoOtkrytV')} />
      {d.loading ? <Loading /> : <Ticket place={d.place} day={d.day} time={d.time} status={t(v.chipKey)} tone={v.tone} />}
      <SafeBanner>{t('screens.dateAccepted.soobschiteBlizkomuGdeI')}</SafeBanner>
      <Btn label={t('screens.dateAccepted.vernutsyaVChat')} onPress={toChat} />
      <VideoCallButton match={match} />
      {v.canCancel ? <Btn kind="ghost" label={t('screens.dateAccepted.izmenitPlan')} onPress={async () => {
        try { await api.cancelDate(date); } catch { toast(t('screens.dateAccepted.neUdalosIzmenitPlan')); return; }
        resetDateDraft(match);
        router.replace({ pathname: '/date-create', params: { match } });
      }} /> : null}
    </Screen>
  );
}
