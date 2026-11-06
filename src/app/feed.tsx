import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Eyebrow, Screen, StateBlock } from '@/components/ui';
import { FilterChip } from '@/components/Kit';
import { Fab, PlanCard } from '@/components/PlanUI';
import { ErrorRetryState, OfflineState } from '@/components/States';
import { LoadingCards } from '@/components/LoadingCards';
import { UiIcon } from '@/components/UiIcon';
import { Tappable } from '@/components/Kit';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { FEED_CHIPS, IDEA_CATEGORIES, PLAN_CATEGORIES, categoryOf, dayOf, type DayKey, type Plan, type PlanCategory } from '@/lib/plans';
import { localeOf } from '@/i18n/current';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// feed · «Планы рядом»: what is happening nearby, grouped by day. The server decides what each person may see
// (audience, age, city, blocks); this screen only filters by category and day.
const DAYS: DayKey[] = ['all', 'today', 'tomorrow', 'weekend', 'later'];
const GROUPS = ['today', 'tomorrow', 'weekend', 'later'] as const;

export default function Feed() {
  const { t } = useLang();
  const { profile } = useSession();
  const [cat, setCat] = useState<PlanCategory | null>(null);
  const [day, setDay] = useState<DayKey>('all');
  const { data, loading, error, reload } = useAsync<Plan[]>(() => api.plansFeed(cat), [cat ?? '']);
  useReloadOnFocus(reload);

  const groups = useMemo(() => {
    const list = (data ?? []).filter((p) => day === 'all' || dayOf(p.starts_at) === day);
    return GROUPS.map((g) => ({ g, items: list.filter((p) => dayOf(p.starts_at) === g) })).filter((x) => x.items.length);
  }, [data, day]);
  const total = groups.reduce((n, x) => n + x.items.length, 0);

  let body: React.ReactNode;
  if (loading && !data) body = <LoadingCards />;
  else if (error?.kind === 'offline') body = <OfflineState onRetry={reload} />;
  else if (error) body = <ErrorRetryState onRetry={reload} />;
  else if (!total) {
    const filtered = cat !== null || day !== 'all';
    body = (
      <StateBlock icon="⌁" title={filtered ? t('plans.feed.emptyTitle') : t('plans.feed.quietTitle')} copy={filtered ? t('plans.feed.emptyCopy') : t('plans.feed.quietCopy')}
        label={t('plans.feed.create')} onPress={() => router.push('/plan-create')}
        secondary={filtered ? <Btn kind="ghost" label={t('plans.feed.reset')} onPress={() => { setCat(null); setDay('all'); }} /> : undefined} />
    );
  } else {
    body = groups.map(({ g, items }) => (
      <View key={g}>
        <View style={s.dayHead}>
          <Text style={s.dayTitle}>{t(g === 'later' ? 'plans.day.laterHead' : (`plans.day.${g}` as 'plans.day.today'))}</Text>
          <Text style={s.dayMeta}>{new Date(items[0].starts_at).toLocaleDateString(localeOf(), { weekday: 'short', day: 'numeric', month: 'long' })} · {items.length}</Text>
        </View>
        {items.map((p) => <PlanCard key={p.id} plan={p} />)}
      </View>
    ));
  }

  return (
    <Screen tabs="feed">
      <View style={s.head}>
        <Text style={s.hello}>{t('plans.feed.h')}</Text>
        <View style={s.headRight}>
          <FilterChip icon="pin" label={profile?.city || t('plans.feed.city')} />
          <Tappable onPress={() => router.push('/my-plans')} label={t('plans.feed.myPlans')} style={s.iconBtn}><UiIcon name="date" size={17} /></Tappable>
        </View>
      </View>
      <Eyebrow style={{ marginTop: 6 }}>{t('plans.feed.ideas')}</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 17 }}>
        {IDEA_CATEGORIES.map((i) => {
          const c = categoryOf(i.key);
          return (
            <Tappable key={i.key} onPress={() => setCat(cat === i.key ? null : i.key)} label={t(c.label)} style={[s.tile, { backgroundColor: c.tint }, cat === i.key && s.tileOn]}>
              <UiIcon name={c.icon} size={20} color={c.ink} />
              <Text style={[s.tileTitle, { color: c.ink }]}>{t(c.label)}</Text>
              <Text style={[s.tileSub, { color: c.ink }]}>{t(i.sub)}</Text>
            </Tappable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scroll} contentContainerStyle={{ paddingHorizontal: 17 }}>
        {DAYS.map((d) => <FilterChip key={d} on={day === d} label={d === 'all' ? t('plans.feed.allDays') : t(`plans.day.${d}` as 'plans.day.today')} onPress={() => setDay(d)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scroll} contentContainerStyle={{ paddingHorizontal: 17 }}>
        <FilterChip tone={cat === null ? 'red' : undefined} label={t('plans.feed.all')} onPress={() => setCat(null)} />
        {FEED_CHIPS.map((k) => <FilterChip key={k} tone={cat === k ? 'red' : undefined} label={t(PLAN_CATEGORIES.find((c) => c.key === k)!.label)} onPress={() => setCat(cat === k ? null : k)} />)}
      </ScrollView>
      {body}
      <Fab label={t('plans.feed.fab')} onPress={() => router.push('/plan-create')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 6 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hello: { fontSize: 22, fontWeight: '800', letterSpacing: -0.9, color: colors.ink, lineHeight: 24 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { marginHorizontal: -17, marginTop: 8, flexGrow: 0 },
  tile: { width: 92, minHeight: 84, borderRadius: 16, padding: 10, justifyContent: 'flex-end', gap: 2 },
  tileOn: { borderWidth: 2, borderColor: colors.ink },
  tileTitle: { fontSize: 12, fontWeight: '800' },
  tileSub: { fontSize: 9.5, opacity: 0.8 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: -2 },
  dayTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink },
  dayMeta: { fontSize: 10.5, color: colors.sub },
});
