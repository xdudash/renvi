import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Eyebrow, Screen, StateBlock, Tag, Tiny, useToast } from '@/components/ui';
import { PeopleHead } from '@/components/PeopleHead';
import { PersonPhoto, cardStyles as c } from '@/components/PeopleCard';
import { ErrorRetryState, OfflineState } from '@/components/States';
import { LoadingCards } from '@/components/LoadingCards';
import { UiIcon } from '@/components/UiIcon';
import { useAsync } from '@/hooks/useAsync';
import { api, type CompanyCard } from '@/lib/api';
import { categoryOf } from '@/lib/plans';
import { useLang } from '@/lib/lang';

// company · people nearby for friends and plans. «Привет» is not a like: only a mutual hello opens a chat.
export default function Company() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync<CompanyCard[]>(() => api.companyFeed(), []);
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const card = (data ?? []).find((x) => !gone.includes(x.id));

  const next = (id: string) => setGone((g) => [...g, id]);
  const skip = async () => {
    if (!card || busy) return;
    setBusy(true);
    try { await api.companyPass(card.id); next(card.id); } catch { toast(t('plans.err.generic')); } finally { setBusy(false); }
  };
  const hello = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const r = await api.companyHello(card.id);
      next(card.id);
      if (r.connected && r.match_id) router.push({ pathname: '/connected', params: { match: r.match_id, name: card.name, look: card.look.join(',') } });
      else toast(t('company.sentHello'));
    } catch (e: any) { toast(e?.kind === 'rate_limited' ? e.message : t('plans.err.generic')); } finally { setBusy(false); }
  };

  let body: React.ReactNode;
  if (loading && !data) body = <LoadingCards />;
  else if (error?.code === 'P0007') {
    body = <StateBlock icon="⌁" title={t('company.closed')} copy={t('company.closedCopy')} label={t('company.openModes')} onPress={() => router.push('/modes')} />;
  } else if (error?.kind === 'offline') body = <OfflineState onRetry={reload} />;
  else if (error) body = <ErrorRetryState onRetry={reload} />;
  else if (!card) {
    body = <StateBlock icon="⌁" title={t('company.empty')} copy={t('company.emptyCopy')} label={t('company.toPlans')} onPress={() => router.replace('/feed')} secondary={<Btn kind="ghost" label={t('common.retry')} onPress={() => { setGone([]); reload(); }} />} />;
  } else {
    body = (
      <>
        <View style={c.card}>
          {card.look.length ? (
            <View style={c.look}>
              <Eyebrow>{t('company.lookFor')}</Eyebrow>
              <View style={c.lookRow}>{card.look.map((k) => <View key={k} style={c.lookChip}><Text style={c.lookChipText}>{t(categoryOf(k).label)}</Text></View>)}</View>
            </View>
          ) : null}
          <PersonPhoto path={card.photo} height={260} />
          <View style={c.body}>
            <View style={c.nameRow}>
              <Text style={c.name}>{card.name}{card.age ? `, ${card.age}` : ''}</Text>
              <Tag label={t(`company.statusPill.${card.status}` as 'company.statusPill.single')} />
            </View>
            {card.city ? <Text style={c.meta}>{card.city}</Text> : null}
            {card.about ? <Text style={c.about}>{card.about}</Text> : null}
            <Text style={c.common}>{t('company.common', { n: card.common, plans: card.plans })}</Text>
          </View>
        </View>
        <View style={c.actions}>
          <View style={c.roundWrap}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('company.skip')} onPress={skip} disabled={busy} style={c.round}><UiIcon name="close" size={20} /></Pressable>
            <Text style={c.label}>{t('company.skip')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={hello} disabled={busy} style={[c.wide, busy && { opacity: 0.6 }]}>
            <UiIcon name="wave" size={20} color="#fff" />
            <Text style={c.wideText}>{t('company.hello')}</Text>
          </Pressable>
        </View>
        <Tiny center>{t('company.note')}</Tiny>
      </>
    );
  }
  return (
    <Screen tabs="discover">
      <PeopleHead active="company" />
      {body}
    </Screen>
  );
}
