import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, ErrorBlock, Eyebrow, Loading, Screen, Segmented, Tag, Title } from '@/components/ui';
import { DarkCard } from '@/components/Kit';
import { PlanCard } from '@/components/PlanUI';
import { UiIcon } from '@/components/UiIcon';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { categoryOf, formatTime, minutesTo } from '@/lib/plans';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// my-plans · what I am going to, what I host, and what has already happened.
type Tab = 'going' | 'mine' | 'past';
export default function MyPlans() {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('going');
  const { data, loading, error, reload } = useAsync(() => api.plansMine(), []);
  useReloadOnFocus(reload);
  if (loading && !data) return <Screen tabs="feed"><BackLink onPress={() => router.replace('/feed')} /><Loading /></Screen>;
  if (error || !data) return <Screen tabs="feed"><BackLink onPress={() => router.replace('/feed')} /><ErrorBlock message={t('plans.err.generic')} onRetry={reload} /></Screen>;

  const soon = data.going.concat(data.hosting).filter((p) => p.status === 'active' && p.my_status !== 'pending').map((p) => ({ p, m: minutesTo(p.starts_at) })).filter((x) => x.m > -180 && x.m < 24 * 60).sort((a, b) => a.m - b.m)[0];
  const rating = (r: string | null | undefined) => (r === 'fire' ? 'green' : 'gray') as 'green' | 'gray';
  return (
    <Screen tabs="feed">
      <BackLink onPress={() => router.replace('/feed')} />
      <Title kicker={t('plans.my.kicker')} heading={t('plans.my.h')} sub={t('plans.my.sub')} />
      <Segmented value={tab} onChange={(k) => setTab(k as Tab)} items={[
        { key: 'going', label: t('plans.my.going', { n: data.going.length }) },
        { key: 'mine', label: t('plans.my.mine', { n: data.hosting.length }) },
        { key: 'past', label: t('plans.my.past', { n: data.past.length }) },
      ]} />
      {soon && tab !== 'past' ? (
        <DarkCard>
          <View style={s.row}>
            <UiIcon name="clock" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.soonTitle}>{t('plans.my.soon', { time: formatTime(soon.p.starts_at), title: soon.p.title })}</Text>
              <Text style={s.soonSub}>{soon.m > 0 ? t('plans.my.in', { m: soon.m }) : t('plans.day.kickerNow', { time: formatTime(soon.p.starts_at) })}</Text>
            </View>
            <View style={{ width: 96 }}><Btn label={t('plans.my.open')} onPress={() => router.push({ pathname: '/plan-day', params: { id: soon.p.id } })} /></View>
          </View>
        </DarkCard>
      ) : null}
      {tab === 'going' ? (data.going.length ? data.going.map((p) => <PlanCard key={p.id} plan={p} />) : <Text style={s.empty}>{t('plans.my.emptyGoing')}</Text>) : null}
      {tab === 'mine' ? (data.hosting.length ? data.hosting.map((p) => (
        <View key={p.id}>
          <PlanCard plan={p} onPress={() => router.push({ pathname: '/plan-requests', params: { id: p.id } })} />
          {(p.pending ?? 0) > 0 ? <View style={{ marginTop: -4, marginBottom: 4, flexDirection: 'row' }}><Tag tone="red" label={t('plans.my.requests', { n: p.pending ?? 0 })} /></View> : null}
        </View>
      )) : <Text style={s.empty}>{t('plans.my.emptyMine')}</Text>) : null}
      {tab === 'past' ? (data.past.length ? (
        <>
          <Eyebrow style={{ marginTop: 6 }}>{t('plans.my.past', { n: data.past.length }).toUpperCase()}</Eyebrow>
          <Card tight>
            {data.past.map((p, i) => {
              const c = categoryOf(p.category);
              return (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/plan-after', params: { id: p.id } })} style={[s.pastRow, i === data.past.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.cover, { backgroundColor: c.tint }]}><UiIcon name={c.icon} size={17} color={c.ink} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pastTitle}>{p.title}</Text>
                    <Text style={s.pastSub}>{new Date(p.starts_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {p.going}</Text>
                  </View>
                  {p.my_rating ? <Tag tone={rating(p.my_rating)} label={t(`plans.rate.${p.my_rating}` as 'plans.rate.fire')} /> : null}
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : <Text style={s.empty}>{t('plans.my.emptyPast')}</Text>) : null}
      <DarkCard style={{ alignItems: 'center' }}>
        <Text style={s.soonTitle}>{t('plans.my.promoTitle')}</Text>
        <Text style={[s.soonSub, { marginVertical: 4, textAlign: 'center' }]}>{t('plans.my.promoCopy')}</Text>
        <View style={{ alignSelf: 'stretch' }}><Btn label={t('plans.feed.create')} onPress={() => router.push('/plan-create')} /></View>
      </DarkCard>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soonTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  soonSub: { fontSize: 11, color: '#cfc8bf', marginTop: 2 },
  empty: { textAlign: 'center', fontSize: 12.5, color: colors.sub, marginVertical: 22 },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EAE3' },
  cover: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pastTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  pastSub: { fontSize: 10.5, color: colors.sub, marginTop: 2 },
});
