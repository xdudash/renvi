import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, ErrorBlock, Loading, Screen, Tag, Title, useToast } from '@/components/ui';
import { SetRow, Switch } from '@/components/Kit';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { formatWhen, type Plan, type PlanRequest } from '@/lib/plans';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plan-requests · the host's side: who asked to join, accept or decline, auto-accept, cancel the plan.
export default function PlanRequests() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);
  const plan = useAsync<Plan>(() => api.planDetail(planId), [planId]);
  const reqs = useAsync<PlanRequest[]>(() => api.planRequests(planId), [planId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [auto, setAuto] = useState<boolean | null>(null);
  const reloadAll = () => { plan.reload(); reqs.reload(); };
  useReloadOnFocus(reloadAll);

  if ((plan.loading && !plan.data) || (reqs.loading && !reqs.data)) return <Screen tabs="feed"><BackLink onPress={() => router.replace('/my-plans')} /><Loading /></Screen>;
  if (plan.error || reqs.error || !plan.data || !reqs.data) return <Screen tabs="feed"><BackLink onPress={() => router.replace('/my-plans')} /><ErrorBlock message={t('plans.err.generic')} onRetry={reloadAll} /></Screen>;
  const p = plan.data;
  const autoOn = auto ?? p.auto_accept;

  const decide = async (r: PlanRequest, accept: boolean) => {
    setBusy(r.user_id);
    try { await api.planDecide(planId, r.user_id, accept); reloadAll(); }
    catch (e: any) { toast(e?.code === 'P0009' ? t('plans.err.full') : t('plans.err.generic')); reloadAll(); }
    finally { setBusy(null); }
  };
  const flipAuto = async (v: boolean) => {
    setAuto(v);
    try { await api.planSetAuto(planId, v); } catch { setAuto(!v); toast(t('plans.err.generic')); }
  };
  const cancelPlan = async () => {
    try { await api.planCancel(planId); toast(t('plans.req.cancelled')); router.replace('/my-plans'); } catch { toast(t('plans.err.generic')); }
  };

  return (
    <Screen tabs="feed">
      <BackLink onPress={() => router.replace('/my-plans')} />
      <Title kicker={t('plans.req.kicker')} heading={t('plans.req.h', { n: reqs.data.length })} sub={t('plans.req.sub', { title: p.title, when: formatWhen(p.starts_at), going: p.going, max: p.max_people })} />
      {p.status === 'active' ? (
        <Card tight><SetRow last title={t('plans.req.auto')} sub={t('plans.req.autoSub')} right={<Switch on={autoOn} onChange={flipAuto} label={t('plans.req.auto')} />} /></Card>
      ) : <Tag tone="red" label={t('plans.d.cancelled')} />}
      {reqs.data.length === 0 ? <Text style={s.empty}>{t('plans.req.empty')}</Text> : null}
      {reqs.data.map((r) => (
        <Card key={r.user_id}>
          <View style={s.row}>
            <View style={s.av}><Text style={s.avText}>{r.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{r.name}{r.age ? `, ${r.age}` : ''}</Text>
              <Text style={s.sub}>{r.plans > 0 ? t('plans.req.past', { n: r.plans }) : ''}</Text>
            </View>
          </View>
          {r.message ? <View style={s.bubble}><Text style={s.bubbleText}>{r.message}</Text></View> : null}
          <View style={s.two}>
            <View style={{ flex: 1 }}><Btn kind="tertiary" label={t('plans.req.notNow')} onPress={() => decide(r, false)} disabled={busy === r.user_id} /></View>
            <View style={{ flex: 1 }}><Btn label={t('plans.req.accept')} onPress={() => decide(r, true)} busy={busy === r.user_id} /></View>
          </View>
        </Card>
      ))}
      <Btn kind="secondary" label={t('plans.d.openChat')} onPress={() => router.push({ pathname: '/plan-chat', params: { id: planId } })} />
      {p.status === 'active' ? <Btn kind="ghost" label={t('plans.req.cancelPlan')} onPress={cancelPlan} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 16, fontWeight: '800', color: colors.ink },
  name: { fontSize: 13, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 11, color: colors.sub, marginTop: 2 },
  bubble: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 15, borderBottomLeftRadius: 5, paddingHorizontal: 11, paddingVertical: 8, marginTop: 9, alignSelf: 'flex-start' },
  bubbleText: { fontSize: 12, lineHeight: 17, color: colors.ink },
  two: { flexDirection: 'row', gap: 8, marginTop: 8 },
  empty: { textAlign: 'center', fontSize: 12.5, color: colors.sub, marginVertical: 18 },
});
