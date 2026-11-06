import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Card, ErrorBlock, Eyebrow, LinkBtn, Loading, Screen, Title, useToast } from '@/components/ui';
import { FilterChip, Hint, SetRow, Switch, Tappable } from '@/components/Kit';
import { UiIcon } from '@/components/UiIcon';
import { api, type Audience, type Modes } from '@/lib/api';
import { useModes } from '@/hooks/useModes';
import { openDate, statusTitleKey } from '@/lib/modes';
import { FEED_CHIPS, categoryOf } from '@/lib/plans';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// modes · «Ты решаешь сам» — which modes show the person to others. Each switch is saved on the server at once.
export default function ModesScreen() {
  const { t } = useLang();
  const toast = useToast();
  const { refresh } = useSession();
  const { modes, loading, error, reload } = useModes();
  const [edited, setLocal] = useState<Modes | null>(null);
  const local = edited ?? modes;
  if (loading && !local) return <Screen tabs="me"><BackLink onPress={() => router.navigate('/me')} /><Loading /></Screen>;
  if (error && !local) return <Screen tabs="me"><BackLink onPress={() => router.navigate('/me')} /><ErrorBlock message={t('modes.saveFail')} onRetry={reload} /></Screen>;
  if (!local) return null;
  const m = local;
  const isSingle = m.status === 'single';
  const isCouple = m.status === 'couple';
  const statusLabel = t(statusTitleKey(m.status));
  const audienceLabel = t(m.audience === 'women' ? 'modes.aWomen' : m.audience === 'men' ? 'modes.aMen' : 'modes.aAll');

  // Optimistic update; the server's answer wins, and a failure puts the previous values back.
  const apply = async (patch: Partial<Pick<Modes, 'dating' | 'company' | 'audience' | 'paused'>>) => {
    const prev = m;
    const next = { ...m, ...patch };
    setLocal(next);
    try {
      await api.setVisibility({ dating: next.dating, company: next.company, audience: next.audience, paused: next.paused });
      await refresh();
      const fresh = await api.myModes();
      setLocal(fresh);
    } catch { setLocal(prev); toast(t('modes.saveFail')); }
  };
  const applyLook = async (look: string[]) => {
    const prev = m;
    setLocal({ ...m, company_look: look });
    try { await api.setCompanyLook(look); } catch { setLocal(prev); toast(t('modes.saveFail')); }
  };
  const datingSub = isSingle
    ? (m.dating_open ? t('modes.datingOpen') : t('modes.datingWait', { date: openDate(m.dating_open_at) }))
    : t('modes.datingClosed', { status: statusLabel });

  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker={t('modes.kicker')} heading={t('modes.h')} sub={t('modes.sub')} />
      <Card tight>
        <Tappable onPress={() => router.push('/status-change')} label={t('modes.change')}>
          <View style={s.statusRow}>
            <View style={{ flex: 1 }}>
              <Eyebrow>{t('modes.statusEyebrow')}</Eyebrow>
              <Text style={s.statusName}>{statusLabel}</Text>
            </View>
            <Text style={s.change}>{t('modes.change')}</Text>
          </View>
        </Tappable>
      </Card>
      <Card tight>
        <SetRow title={t('modes.dating')} sub={datingSub}
          right={isSingle ? <Switch on={m.dating} onChange={(v) => apply({ dating: v })} label={t('modes.dating')} /> : <UiIcon name="lock" size={16} color={colors.sub} />} />
        <SetRow title={t('modes.company')} sub={t('modes.companyShow', { to: audienceLabel })}
          right={!isCouple ? <Switch on={m.company} onChange={(v) => apply({ company: v })} label={t('modes.company')} /> : <UiIcon name="lock" size={16} color={colors.sub} />} />
        {m.company && !isCouple ? (
          <View style={s.chips}>
            {(['all', 'women', 'men'] as Audience[]).map((a) => (
              <FilterChip key={a} on={m.audience === a} label={t(a === 'women' ? 'modes.aWomen' : a === 'men' ? 'modes.aMen' : 'modes.aAll')} onPress={() => apply({ audience: a })} />
            ))}
          </View>
        ) : null}
        {m.company && !isCouple ? (
          <View style={s.look}>
            <Text style={s.lookTitle}>{t('company.lookTitle')}</Text>
            <Text style={s.lookSub}>{t('company.lookSub')}</Text>
            <View style={s.chips}>
              {FEED_CHIPS.map((k) => {
                const on = (m.company_look ?? []).includes(k);
                return <FilterChip key={k} on={on} label={t(categoryOf(k).label)} onPress={() => applyLook(on ? m.company_look.filter((x) => x !== k) : [...(m.company_look ?? []), k].slice(0, 8))} />;
              })}
            </View>
          </View>
        ) : null}
        <SetRow title={t('modes.pairs')} sub={isCouple ? t('modes.pairsOn') : t('modes.pairsOff')}
          right={isCouple ? <UiIcon name="check" size={18} color={colors.green} /> : <LinkBtn label={t('modes.link')} onPress={() => router.push('/ob-pair')} />} />
        <SetRow last title={t('modes.plans')} sub={t('modes.plansSub')} right={<Text style={s.always}>{t('modes.always')}</Text>} />
      </Card>
      <Card tight>
        <SetRow last title={t('modes.pause')} sub={t('modes.pauseSub')} right={<Switch on={m.paused} onChange={(v) => apply({ paused: v })} label={t('modes.pause')} />} />
      </Card>
      <Hint>{t('modes.hint')}</Hint>
    </Screen>
  );
}

const s = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusName: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 3 },
  change: { fontSize: 11, fontWeight: '700', color: colors.redDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 10 },
  look: { paddingBottom: 6 },
  lookTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  lookSub: { fontSize: 10.5, color: colors.sub, marginTop: 2, marginBottom: 8 },
  always: { fontSize: 10.5, color: colors.sub },
});
