import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, ErrorBlock, Eyebrow, Loading, Screen, Tag, Title, useToast } from '@/components/ui';
import { Faces } from '@/components/PlanUI';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate, type Plan } from '@/lib/plans';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plan-after · how it went: a private rating and who was there.
const RATINGS = ['meh', 'ok', 'fire'] as const;
export default function PlanAfter() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);
  const plan = useAsync<Plan>(() => api.planDetail(planId), [planId]);
  const people = useAsync(() => api.planPeople(planId), [planId]);
  const mine = useAsync(() => api.plansMine().then((r) => r.past.find((p) => p.id === planId)?.my_rating ?? null), [planId]);
  const [picked, setPicked] = useState<'meh' | 'ok' | 'fire' | null>(null);
  const check = useAsync(() => api.planCheckMine(planId), [planId]);
  const [checked, setChecked] = useState<'ok' | 'help' | null>(null);
  const [greeted, setGreeted] = useState<string[]>([]);
  if ((plan.loading && !plan.data) || (people.loading && !people.data) || mine.loading) return <Screen tabs="feed"><BackLink /><Loading /></Screen>;
  if (plan.error || people.error || !plan.data || !people.data) return <Screen tabs="feed"><BackLink /><ErrorBlock message={t('plans.err.generic')} onRetry={() => { plan.reload(); people.reload(); }} /></Screen>;
  const p = plan.data;
  const rating = picked ?? mine.data ?? null;
  const rate = async (r: (typeof RATINGS)[number]) => {
    setPicked(r);
    try { await api.planRate(planId, r); toast(t('plans.after.thanks')); } catch { setPicked(null); toast(t('plans.err.generic')); }
  };
  const answer = async (ok: boolean) => {
    try {
      await api.planCheckAnswer(planId, ok);
      setChecked(ok ? 'ok' : 'help');
      if (ok) toast(t('plans.check.thanks')); else router.push('/safety');
    } catch { toast(t('plans.err.generic')); }
  };
  const greet = async (userId: string, name: string) => {
    try {
      const r = await api.planCompanyHello(planId, userId);
      setGreeted((g) => [...g, userId]);
      if (r.connected && r.match_id) router.push({ pathname: '/connected', params: { match: r.match_id, name } });
      else toast(t('plans.after.companySent'));
    } catch (e: any) { toast(e?.code === 'P0007' || e?.code === 'P0002' ? t('plans.after.companyClosed') : t('plans.err.generic')); }
  };
  const asked = check.data ? (checked ?? check.data.answer) : null;
  return (
    <Screen tabs="feed">
      <BackLink onPress={() => router.replace('/my-plans')} />
      <Title kicker={`${p.title} · ${formatDate(p.starts_at)}`.toUpperCase()} heading={t('plans.after.h')} sub={t('plans.after.sub')} />
      <View style={s.three}>
        {RATINGS.map((r) => (
          <Pressable key={r} accessibilityRole="button" accessibilityState={{ selected: rating === r }} onPress={() => rate(r)} style={[s.rate, rating === r && s.rateOn]}>
            <Text style={s.rateText}>{t(`plans.rate.${r}` as 'plans.rate.fire')}</Text>
          </Pressable>
        ))}
      </View>
      {check.data && asked !== 'ok' ? (
        <Card tight>
          <Eyebrow>{t('plans.check.h')}</Eyebrow>
          <Text style={s.empty}>{t('plans.check.sub')}</Text>
          <View style={s.three}>
            <View style={{ flex: 1 }}><Btn label={t('plans.check.ok')} onPress={() => answer(true)} /></View>
            <View style={{ flex: 1 }}><Btn kind="secondary" label={t('plans.check.help')} onPress={() => answer(false)} /></View>
          </View>
        </Card>
      ) : null}
      <Card tight>
        <Eyebrow>{t('plans.after.came')}</Eyebrow>
        {people.data.length === 0 ? <Text style={s.empty}>{t('plans.after.nobody')}</Text> : null}
        {people.data.map((x) => (
          <View key={x.user_id} style={s.person}>
            <Faces names={[x.name]} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{x.name}{x.age ? `, ${x.age}` : ''}</Text>
              {x.host ? <Text style={s.sub}>{t('plans.d.host')}</Text> : null}
            </View>
            {!x.came ? <Tag label="—" /> : greeted.includes(x.user_id) ? <Tag label="✓" /> : (
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('plans.after.company')}: ${x.name}`} onPress={() => greet(x.user_id, x.name)} style={s.greet}><Text style={s.greetText}>{t('plans.after.company')}</Text></Pressable>
            )}
          </View>
        ))}
      </Card>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/report', params: { profile: p.host.id } })} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={s.bad}>{t('plans.after.bad')}</Text>
      </Pressable>
      <Btn label={t('plans.after.again')} onPress={() => router.push('/plan-create')} />
      <Btn kind="ghost" label={t('plans.after.done')} onPress={() => router.replace('/feed')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  three: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  rate: { flex: 1, minHeight: 56, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  rateOn: { borderColor: colors.ink },
  rateText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EAE3' },
  name: { fontSize: 13, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 10.5, color: colors.sub },
  empty: { fontSize: 12, color: colors.sub, marginVertical: 10 },
  greet: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.ink },
  greetText: { fontSize: 11.5, fontWeight: '800', color: colors.ink },
  bad: { fontSize: 12, fontWeight: '700', color: '#A42623' },
});
