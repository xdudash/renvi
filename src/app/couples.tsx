import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, StateBlock, Tag, useToast } from '@/components/ui';
import { PeopleHead } from '@/components/PeopleHead';
import { PersonPhoto, cardStyles as c } from '@/components/PeopleCard';
import { LockedMode } from '@/components/LockedMode';
import { ErrorRetryState, OfflineState } from '@/components/States';
import { LoadingCards } from '@/components/LoadingCards';
import { UiIcon } from '@/components/UiIcon';
import { useAsync } from '@/hooks/useAsync';
import { useModes } from '@/hooks/useModes';
import { api, type CoupleCard } from '@/lib/api';
import { useLang } from '@/lib/lang';

// couples · couples meet couples. A mutual «позвать вчетвером» opens a chat between the two people who pressed it.
export default function Couples() {
  const { t } = useLang();
  const toast = useToast();
  const { modes } = useModes();
  const { data, loading, error, reload } = useAsync<CoupleCard[]>(() => api.couplesFeed(), []);
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const card = (data ?? []).find((x) => !gone.includes(x.couple_id));

  const skip = async () => {
    if (!card || busy) return;
    setBusy(true);
    try { await api.couplesPass(card.couple_id); setGone((g) => [...g, card.couple_id]); } catch { toast(t('plans.err.generic')); } finally { setBusy(false); }
  };
  const hello = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const r = await api.couplesHello(card.couple_id);
      setGone((g) => [...g, card.couple_id]);
      if (r.connected && r.match_id) router.push({ pathname: '/connected', params: { match: r.match_id, name: card.people.map((p) => p.name).join(' + '), kind: 'couples' } });
      else toast(t('company.sentHello'));
    } catch (e: any) { toast(e?.kind === 'rate_limited' ? e.message : t('plans.err.generic')); } finally { setBusy(false); }
  };

  let body: React.ReactNode;
  if (error?.code === 'P0007') body = <LockedMode mode="couples" modes={modes} />;
  else if (loading && !data) body = <LoadingCards />;
  else if (error?.kind === 'offline') body = <OfflineState onRetry={reload} />;
  else if (error) body = <ErrorRetryState onRetry={reload} />;
  else if (!card) body = <StateBlock icon="⌁" title={t('couples.empty')} copy={t('couples.emptyCopy')} label={t('common.retry')} onPress={() => { setGone([]); reload(); }} />;
  else {
    const [a, b] = card.people;
    body = (
      <>
        <View style={c.card}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}><PersonPhoto path={a.photo} height={190} /></View>
            <View style={{ flex: 1 }}><PersonPhoto path={b.photo} height={190} /></View>
          </View>
          <View style={c.body}>
            <View style={c.nameRow}>
              <Text style={c.name}>{t('couples.title', { a: a.name, b: b.name })}</Text>
              <Tag tone="amber" label={t('couples.pair')} />
            </View>
            <Text style={c.meta}>{[a.age && b.age ? t('couples.ages', { a: a.age, b: b.age }) : '', card.city ?? ''].filter(Boolean).join(' · ')}</Text>
            {card.about ? <Text style={c.about}>{card.about}</Text> : null}
            {card.tags.length ? <View style={c.lookRow}>{card.tags.map((x) => <Tag key={x} tone="amber" label={x} />)}</View> : null}
          </View>
        </View>
        <View style={c.actions}>
          <View style={c.roundWrap}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('company.skip')} onPress={skip} disabled={busy} style={c.round}><UiIcon name="close" size={20} /></Pressable>
            <Text style={c.label}>{t('company.skip')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={hello} disabled={busy} style={[c.wide, busy && { opacity: 0.6 }]}>
            <UiIcon name="couple" size={20} color="#fff" />
            <Text style={c.wideText}>{t('couples.together')}</Text>
          </Pressable>
        </View>
      </>
    );
  }
  return (
    <Screen tabs="discover">
      <PeopleHead active="couples" />
      {body}
    </Screen>
  );
}
