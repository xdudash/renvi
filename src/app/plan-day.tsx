import { useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, ErrorBlock, Eyebrow, LinkBtn, Loading, Screen, useToast } from '@/components/ui';
import { DarkCard, SetRow, StepList } from '@/components/Kit';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { formatTime, minutesTo, type Plan } from '@/lib/plans';
import { inviteUrl } from '@/lib/referral';
import { useLang } from '@/lib/lang';

// plan-day · the screen for the day of the meeting: check in, directions, share with someone close, safety notes.
export default function PlanDay() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);
  const plan = useAsync<Plan>(() => api.planDetail(planId), [planId]);
  const who = useAsync(() => api.planArrivals(planId), [planId]);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const reload = () => { plan.reload(); who.reload(); };
  useReloadOnFocus(reload);
  if ((plan.loading && !plan.data) || (who.loading && !who.data)) return <Screen tabs="feed"><BackLink /><Loading /></Screen>;
  if (plan.error || who.error || !plan.data || !who.data) return <Screen tabs="feed"><BackLink /><ErrorBlock message={t('plans.err.generic')} onRetry={reload} /></Screen>;
  const p = plan.data;
  const m = minutesTo(p.starts_at);
  const here = who.data.filter((x) => x.here).map((x) => x.name);
  const onWay = who.data.filter((x) => !x.here).map((x) => x.name);
  const place = p.place ?? p.area;
  const link = `${inviteUrl('').replace(/\/invite\/$/, '')}/plan?id=${p.id}`;

  const checkin = async () => {
    setBusy(true);
    try { await api.planCheckin(planId); setChecked(true); who.reload(); }
    catch (e: any) { toast(e?.code === 'P0002' ? t('plans.day.notYet') : t('plans.err.generic')); }
    finally { setBusy(false); }
  };
  const leave = async () => { try { await api.planWithdraw(planId); toast(t('plans.d.left')); router.replace('/my-plans'); } catch { toast(t('plans.err.generic')); } };

  return (
    <Screen tabs="feed">
      <BackLink onPress={() => router.back()} />
      <DarkCard>
        <Text style={s.kicker}>{(m > 0 ? t('plans.day.kicker', { m }) : t('plans.day.kickerNow', { time: formatTime(p.starts_at) })).toUpperCase()}</Text>
        <Text style={s.title}>{p.title}</Text>
        <Text style={s.sub}>{place} · {formatTime(p.starts_at)}</Text>
        <View style={s.two}>
          <View style={{ flex: 1 }}><Btn label={checked ? t('plans.day.hereDone') : t('plans.day.here')} onPress={checkin} busy={busy} disabled={p.is_host || checked} /></View>
          <View style={{ flex: 1 }}><Btn kind="secondary" label={t('plans.day.directions')} onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(place)}`).catch(() => toast(t('plans.err.generic')))} /></View>
        </View>
        <Text style={[s.sub, { marginTop: 9 }]}>{[here.length ? t('plans.day.there', { names: here.join(', ') }) : '', onWay.length ? t('plans.day.onWay', { names: onWay.join(', ') }) : ''].filter(Boolean).join(' · ')}</Text>
      </DarkCard>
      <Card tight>
        <SetRow last title={t('plans.day.shareRow')} sub={t('plans.day.shareSub')}
          right={<LinkBtn label={t('plans.day.send')} onPress={() => Share.share({ message: t('plans.shareText', { title: `${p.title} · ${formatTime(p.starts_at)} · ${place}`, url: link }) }).catch(() => toast(t('plans.err.generic')))} />} />
      </Card>
      <Card tight>
        <Eyebrow>{t('plans.day.memo')}</Eyebrow>
        <StepList items={[t('plans.day.m1'), t('plans.day.m2'), t('plans.day.m3')]} />
      </Card>
      <View style={s.two}>
        {!p.is_host ? <View style={{ flex: 1 }}><Btn kind="ghost" label={t('plans.d.leave')} onPress={leave} /></View> : null}
        <View style={{ flex: 1 }}><Btn kind="warn" label={t('plans.day.wrong')} onPress={() => router.push({ pathname: '/report', params: { profile: p.host.id } })} /></View>
      </View>
      <Btn kind="ghost" label={t('plans.d.openChat')} onPress={() => router.push({ pathname: '/plan-chat', params: { id: p.id } })} />
    </Screen>
  );
}

const s = StyleSheet.create({
  kicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, color: '#F3B7AE' },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.6, color: '#fff', marginTop: 5 },
  sub: { fontSize: 11.5, color: '#cfc8bf', marginTop: 3 },
  two: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
