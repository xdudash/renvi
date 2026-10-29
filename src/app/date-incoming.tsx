import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Loading, SafeBanner, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDateRow } from '@/hooks/useDate';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { DATE_PLACES } from '@/lib/catalog';
import { resetDateDraft } from '@/lib/dateDraft';
import { useLang } from '@/lib/lang';
import { VideoCallButton } from '@/components/VideoCallButton';
import { useSession } from '@/lib/session';
import { dateView } from '@/lib/dateStatus';

// 59 · Входящее приглашение · ответ
export default function DateIncoming() {
  const { t } = useLang();
  const { match, date } = useLocalSearchParams<{ match: string; date: string }>();
  const toast = useToast();
  const d = useDateRow(date);
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const respond = async (action: 'accept' | 'decline') => {
    setBusy(true);
    try {
      await api.respondDate(date, action);
      router.replace({ pathname: action === 'accept' ? '/date-accepted' : '/date-declined', params: { match, date } });
    } catch { toast(t('screens.dateIncoming.neUdalosOtvetit')); } finally { setBusy(false); }
  };
  // "Propose another time" declines first; if that fails the old invitation would stay pending next to the new one.
  const proposeOther = async () => {
    setBusy(true);
    try {
      await api.respondDate(date, 'decline');
    } catch {
      toast(t('screens.dateIncoming.neUdalosOtvetit'));
      setBusy(false);
      return;
    }
    setBusy(false);
    resetDateDraft(match);
    router.replace({ pathname: '/date-create', params: { match } });
  };
  if (d.loading || ctx.loading) return <Screen tabs="chats"><BackLink /><Loading /></Screen>;
  // The invitation may already be answered or cancelled (push, back stack, stale chat card): no Accept / Decline then.
  const v = dateView(d.data?.status, d.data ? d.data.proposer_id === session?.user.id : false);
  const icon = DATE_PLACES.find((p) => p.key === d.data?.place_key)?.icon ?? '☕';
  return (
    <Screen tabs="chats">
      <BackLink onPress={() => router.replace({ pathname: '/chat', params: { match } })} />
      <Title kicker={t('screens.dateIncoming.priglashenie')} heading={t('screens.dateIncoming.vPredlagaetVstretitsya', { name: ctx.data?.partner.name ?? '' })} sub={t('screens.dateIncoming.vyMozhetePrinyatPlan')} />
      <Card>
        <Chip label={t(v.chipKey)} tone={v.tone} />
        <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -1, marginTop: 10 }}>{icon} {d.place} · {d.day.toLowerCase()}</Text>
        <Tiny>{t('screens.dateIncoming.publichnoeMestoTime', { time: d.time })}</Tiny>
        {d.data?.note ? <Text style={{ fontSize: 12, marginTop: 8 }}>«{d.data.note}»</Text> : null}
      </Card>
      {v.canRespond ? (
        <>
          <Btn label={t('screens.dateIncoming.prinyatPriglashenie')} busy={busy} onPress={() => respond('accept')} />
          <Btn kind="secondary" label={t('screens.dateIncoming.predlozhitDrugoeVremya')} disabled={busy} onPress={proposeOther} />
          <Btn kind="ghost" label={t('screens.dateIncoming.vezhlivoOtkazatsya')} disabled={busy} onPress={() => respond('decline')} />
        </>
      ) : null}
      <VideoCallButton match={match} />
      <SafeBanner>{t('screens.dateIncoming.vyNeObyazanyObyasnyat')}</SafeBanner>
    </Screen>
  );
}
