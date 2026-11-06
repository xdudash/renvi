import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Field, Eyebrow, Screen, Tiny, Title, useToast } from '@/components/ui';
import { FilterChip, SetRow, Switch } from '@/components/Kit';
import { UiIcon } from '@/components/UiIcon';
import { api } from '@/lib/api';
import { CREATE_CATEGORIES, categoryOf, type PlanAudience, type PlanCategory } from '@/lib/plans';
import { localeOf } from '@/i18n/current';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plan-create · «Что делаем?» — the district is public, the exact place opens only to people the host accepts.
const AUDIENCES: { key: PlanAudience; label: 'plans.aud.all' | 'plans.aud.womenC' | 'plans.aud.menC' | 'plans.aud.couplesC' }[] = [
  { key: 'all', label: 'plans.aud.all' }, { key: 'women', label: 'plans.aud.womenC' }, { key: 'men', label: 'plans.aud.menC' }, { key: 'couples', label: 'plans.aud.couplesC' },
];
const parseTime = (v: string): [number, number] | null => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  return h < 24 && min < 60 ? [h, min] : null;
};

export default function PlanCreate() {
  const { t } = useLang();
  const toast = useToast();
  const [cat, setCat] = useState<PlanCategory>('market');
  const [title, setTitle] = useState('');
  const [dayOffset, setDayOffset] = useState(1);
  const [time, setTime] = useState('18:00');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [place, setPlace] = useState('');
  const [size, setSize] = useState(6);
  const [aud, setAud] = useState<PlanAudience>('all');
  const [ages, setAges] = useState<[number, number] | null>(null);
  const [desc, setDesc] = useState('');
  const [bring, setBring] = useState('');
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); return d; }), []);

  const publish = async () => {
    const tm = parseTime(time);
    if (title.trim().length < 3) { toast(t('plans.new.badTitle')); return; }
    if (area.trim().length < 2 || place.trim().length < 3) { toast(t('plans.new.badPlace')); return; }
    const when = new Date(days[dayOffset]);
    if (tm) when.setHours(tm[0], tm[1], 0, 0);
    if (!tm || when.getTime() <= Date.now()) { toast(t('plans.new.badWhen')); return; }
    setBusy(true);
    try {
      const plan = await api.planCreate({
        category: cat, title: title.trim(), starts_at: when.toISOString(), price_text: price.trim(), area: area.trim(), place: place.trim(),
        max_people: size, audience: aud, age_min: ages?.[0] ?? null, age_max: ages?.[1] ?? null, description: desc.trim(),
        bring: bring.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10), auto_accept: auto,
      });
      router.replace({ pathname: '/plan-created', params: { id: plan.id } });
    } catch (e: any) {
      if (e?.code === 'P0008') router.replace('/plan-limit');
      else toast(e?.kind === 'rate_limited' ? e.message : t('plans.err.generic'));
    } finally { setBusy(false); }
  };

  return (
    <Screen tabs="feed">
      <BackLink onPress={() => (router.canGoBack() ? router.back() : router.replace('/feed'))} />
      <Title kicker={t('plans.new.kicker')} heading={t('plans.new.h')} sub={t('plans.new.sub')} />
      <View style={s.grid}>
        {CREATE_CATEGORIES.map((k) => {
          const c = categoryOf(k);
          return (
            <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: cat === k }} onPress={() => setCat(k)} style={[s.cell, cat === k && s.cellOn]}>
              <UiIcon name={c.icon} size={18} />
              <Text style={[s.cellText, cat === k && { fontWeight: '800' }]} numberOfLines={1}>{t(c.label)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label={t('plans.new.name')} value={title} onChangeText={setTitle} maxLength={80} placeholder={t('plans.new.namePh')} />
      <Eyebrow style={{ marginTop: 10, marginBottom: 4 }}>{t('plans.new.day')}</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -17, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 17 }}>
        {days.map((d, i) => (
          <FilterChip key={i} on={dayOffset === i} onPress={() => setDayOffset(i)}
            label={i === 0 ? t('plans.day.today') : i === 1 ? t('plans.day.tomorrow') : d.toLocaleDateString(localeOf(), { weekday: 'short', day: 'numeric' })} />
        ))}
      </ScrollView>
      <View style={s.two}>
        <View style={{ flex: 1 }}><Field label={t('plans.new.time')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
        <View style={{ flex: 1 }}><Field label={t('plans.new.price')} value={price} onChangeText={setPrice} maxLength={40} placeholder={t('plans.new.pricePh')} /></View>
      </View>
      <Field label={t('plans.new.area')} value={area} onChangeText={setArea} maxLength={60} placeholder={t('plans.new.areaPh')} />
      <Field label={t('plans.new.place')} value={place} onChangeText={setPlace} maxLength={120} placeholder={t('plans.new.placePh')} />
      <Tiny>{t('plans.new.placeHelp')}</Tiny>
      <Card tight>
        <View style={s.stepRow}>
          <Text style={s.stepLabel}>{t('plans.new.size')}</Text>
          <View style={s.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('plans.new.less')} onPress={() => setSize((n) => Math.max(2, n - 1))} style={s.stepBtn}><Text style={s.stepBtnText}>−</Text></Pressable>
            <Text style={s.stepNum}>{size}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('plans.new.more')} onPress={() => setSize((n) => Math.min(30, n + 1))} style={s.stepBtn}><Text style={s.stepBtnText}>+</Text></Pressable>
          </View>
        </View>
      </Card>
      <Eyebrow style={{ marginTop: 10, marginBottom: 6 }}>{t('plans.new.who')}</Eyebrow>
      <View style={s.wrap}>
        {AUDIENCES.map((a) => <FilterChip key={a.key} on={aud === a.key} label={t(a.label)} onPress={() => setAud(a.key)} />)}
        <FilterChip on={!!ages} label={ages ? t('plans.new.ages', { min: ages[0], max: ages[1] }) : t('plans.new.anyAge')} onPress={() => setAges(ages ? null : [20, 35])} />
      </View>
      {ages ? (
        <View style={s.stepRow}>
          {([0, 1] as const).map((i) => (
            <View key={i} style={s.stepper}>
              <Pressable accessibilityRole="button" onPress={() => setAges((a) => a && (i === 0 ? [Math.max(18, a[0] - 1), a[1]] : [a[0], Math.max(a[0], a[1] - 1)]))} style={s.stepBtn}><Text style={s.stepBtnText}>−</Text></Pressable>
              <Text style={s.stepNum}>{ages[i]}</Text>
              <Pressable accessibilityRole="button" onPress={() => setAges((a) => a && (i === 0 ? [Math.min(a[1], a[0] + 1), a[1]] : [a[0], Math.min(99, a[1] + 1)]))} style={s.stepBtn}><Text style={s.stepBtnText}>+</Text></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Field label={t('plans.new.desc')} value={desc} onChangeText={setDesc} multiline maxLength={600} placeholder={t('plans.new.descPh')} style={{ minHeight: 76, textAlignVertical: 'top' }} />
      <Field label={t('plans.new.bring')} value={bring} onChangeText={setBring} maxLength={200} />
      <Card tight>
        <SetRow last title={t('plans.new.auto')} sub={t('plans.new.autoSub')} right={<Switch on={auto} onChange={setAuto} label={t('plans.new.auto')} />} />
      </Card>
      <Btn label={t('plans.new.publish')} onPress={publish} busy={busy} />
      <Tiny>{t('plans.new.limit', { n: 2 })}</Tiny>
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  cell: { width: '23.5%', borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFCF9', borderRadius: 13, paddingVertical: 9, paddingHorizontal: 2, alignItems: 'center', gap: 4 },
  cellOn: { borderWidth: 2, borderColor: colors.ink, backgroundColor: '#fff' },
  cellText: { fontSize: 10, fontWeight: '600', color: colors.ink },
  two: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginVertical: 4 },
  stepLabel: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F7F5F2', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: colors.ink },
  stepNum: { fontSize: 15, fontWeight: '800', minWidth: 22, textAlign: 'center', color: colors.ink },
});
