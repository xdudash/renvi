import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, ErrorBlock, Eyebrow, Field, Loading, Screen, Tag, Tiny, useToast } from '@/components/ui';
import { Faces, PlanCover } from '@/components/PlanUI';
import { UiIcon } from '@/components/UiIcon';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { formatDate, formatTime, type Plan } from '@/lib/plans';
import { inviteUrl } from '@/lib/referral';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plan · one plan: when, where (the exact place opens only after approval), who is going, and the way in.
export default function PlanScreen() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plan, loading, error, reload } = useAsync<Plan>(() => api.planDetail(String(id)), [String(id)]);
  useReloadOnFocus(reload);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !plan) return <Screen tabs="feed"><BackLink /><Loading /></Screen>;
  if (error || !plan) return <Screen tabs="feed"><BackLink /><ErrorBlock message={error?.kind === 'not_found' ? t('plans.err.closed') : t('plans.err.generic')} onRetry={reload} /></Screen>;

  const full = plan.going >= plan.max_people;
  const mine = plan.my_status;
  const inPlan = mine === 'going' || mine === 'host';
  const canJoin = plan.open && !plan.is_host && !full && (mine === null || mine === 'left' || mine === 'cancelled');
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    try { await fn(); after?.(); }
    catch (e: any) { toast(e?.code === 'P0009' ? t('plans.err.full') : e?.code === 'P0005' ? t('plans.err.already') : e?.code === 'P0002' ? t('plans.err.closed') : t('plans.err.generic')); reload(); }
    finally { setBusy(false); }
  };
  const join = () => run(() => api.planRequest(plan.id, note.trim() || null), () => router.replace({ pathname: '/plan-join', params: { id: plan.id } }));
  const withdraw = () => run(() => api.planWithdraw(plan.id), () => { toast(mine === 'going' ? t('plans.d.left') : t('plans.d.cancelReq')); reload(); });
  const share = () => Share.share({ message: t('plans.shareText', { title: plan.title, url: `${inviteUrl('').replace(/\/invite\/$/, '')}/plan?id=${plan.id}` }) }).catch(() => toast(t('plans.err.generic')));
  const ages = plan.age_min || plan.age_max ? ` · ${t('plans.d.ageRange', { min: plan.age_min ?? 18, max: plan.age_max ?? 99 })}` : '';
  const audience = plan.audience === 'all' ? t('plans.aud.all') : t(`plans.aud.${plan.audience}C` as 'plans.aud.womenC');

  return (
    <Screen tabs="feed">
      <BackLink onPress={() => (router.canGoBack() ? router.back() : router.replace('/feed'))} />
      <PlanCover plan={plan} height={96} />
      <Text style={s.h1} accessibilityRole="header">{plan.title}</Text>
      <View style={s.tags}>
        <Tag label={`${formatDate(plan.starts_at)} · ${formatTime(plan.starts_at)}`} />
        {plan.price_text ? <Tag label={plan.price_text} /> : null}
        {plan.status === 'cancelled' ? <Tag tone="red" label={t('plans.d.cancelled')} /> : null}
      </View>
      <Card tight>
        <View style={s.row}>
          <UiIcon name="pin" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={s.bold}>{plan.area}</Text>
            <Text style={s.sub}>{plan.place ?? t('plans.d.where')}</Text>
          </View>
          {plan.place ? null : <UiIcon name="lock" size={15} />}
        </View>
      </Card>
      <Card tight>
        <View style={s.row}>
          <View style={s.av}><Text style={s.avText}>{plan.host.name.slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.bold}>{plan.host.name}{plan.host.age ? `, ${plan.host.age}` : ''}</Text>
            <Text style={s.sub}>{plan.host_stats ? t('plans.d.hostLine', { plans: plan.host_stats.plans, people: plan.host_stats.people }) : t('plans.d.host')}</Text>
          </View>
        </View>
      </Card>
      <Eyebrow style={{ marginTop: 12 }}>{t('plans.d.who', { going: plan.going, max: plan.max_people })}</Eyebrow>
      <View style={[s.row, { marginVertical: 8, gap: 12 }]}>
        <View style={s.faceCol}><Faces names={[plan.host.name]} size={44} /><Text style={s.faceName}>{plan.host.name}</Text></View>
        {plan.faces.map((f) => <View key={f.id} style={s.faceCol}><Faces names={[f.name]} size={44} /><Text style={s.faceName}>{f.name}</Text></View>)}
        {canJoin ? <View style={s.faceCol}><View style={s.you} /><Text style={[s.faceName, { color: '#8A847C' }]}>{t('plans.d.you')}</Text></View> : null}
      </View>
      {plan.description ? <Text style={s.desc}>{plan.description}</Text> : null}
      <Tiny><Text style={s.bold}>{t('plans.d.whoCan')}</Text> {audience}{ages}</Tiny>
      {plan.bring.length ? <View style={{ marginTop: 4 }}><Tiny><Text style={s.bold}>{t('plans.d.bring')}</Text> {plan.bring.join(', ')}</Tiny></View> : null}

      {plan.is_host ? (
        <>
          {plan.status === 'active' ? <Btn label={t('plans.req.h', { n: plan.pending ?? 0 })} onPress={() => router.push({ pathname: '/plan-requests', params: { id: plan.id } })} /> : null}
          <Btn kind="secondary" label={t('plans.d.openChat')} onPress={() => router.push({ pathname: '/plan-chat', params: { id: plan.id } })} />
        </>
      ) : mine === 'pending' ? (
        <>
          <View style={s.soft}><Text style={s.bold}>{t('plans.d.requested')}</Text><Text style={s.sub}>{t('plans.d.requestedCopy')}</Text></View>
          <Btn kind="ghost" label={t('plans.d.cancelReq')} onPress={withdraw} busy={busy} />
        </>
      ) : mine === 'going' ? (
        <>
          <View style={s.ok}><Text style={s.okText}>{t('plans.d.goingNow')}</Text></View>
          <Btn label={t('plans.d.openChat')} onPress={() => router.push({ pathname: '/plan-chat', params: { id: plan.id } })} />
          <Btn kind="ghost" label={t('plans.d.leave')} onPress={withdraw} busy={busy} />
        </>
      ) : canJoin ? (
        <>
          <Field label={t('plans.d.noteLabel')} value={note} onChangeText={setNote} maxLength={200} placeholder={t('plans.d.notePh')} />
          <Btn label={plan.auto_accept ? t('plans.d.joinAuto') : t('plans.d.join')} onPress={join} busy={busy} />
        </>
      ) : (
        <View style={s.soft}><Text style={s.sub}>{plan.status === 'cancelled' ? t('plans.d.cancelled') : !plan.open ? t('plans.d.ended') : mine === 'declined' ? t('plans.d.declined') : t('plans.d.full')}</Text></View>
      )}
      <View style={s.two}>
        <View style={{ flex: 1 }}><Btn kind="tertiary" label={t('plans.d.share')} onPress={share} /></View>
        {!plan.is_host ? <View style={{ flex: 1 }}><Btn kind="tertiary" label={t('plans.d.report')} onPress={() => router.push({ pathname: '/report', params: { profile: plan.host.id } })} /></View> : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.9, lineHeight: 26, color: colors.ink, marginTop: 12, marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bold: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 11, color: colors.sub, marginTop: 2 },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 16, fontWeight: '800', color: colors.ink },
  faceCol: { alignItems: 'center', gap: 3 },
  faceName: { fontSize: 10, color: colors.ink },
  you: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CFC8BF' },
  desc: { fontSize: 12.5, lineHeight: 19, color: colors.ink, marginVertical: 8 },
  soft: { backgroundColor: colors.redWash, borderRadius: 16, padding: 13, marginTop: 12, gap: 3 },
  ok: { backgroundColor: '#E3F0E8', borderRadius: 16, padding: 13, marginTop: 12 },
  okText: { fontSize: 13, fontWeight: '800', color: colors.green },
  two: { flexDirection: 'row', gap: 8 },
});
