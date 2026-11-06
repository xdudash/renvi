import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, ErrorBlock, Loading, Screen, StateBlock, Tiny, Title, useToast } from '@/components/ui';
import { DarkCard, Tappable } from '@/components/Kit';
import { useAsync } from '@/hooks/useAsync';
import { api, type Tier } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { boostPrices, buyBoost, initPurchases, purchasesAvailable, syncBoost } from '@/lib/purchases';
import { formatDate, type Plan } from '@/lib/plans';
import { refreshTier, useMyTier } from '@/lib/tier';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plan-boost · put the host's plan first in the feed for 3 or 24 hours (paid, App Store) or once a week free with Plus.
export default function PlanBoost() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { uid, tier } = useMyTier();
  const plan = useAsync<Plan | null>(async () => (id ? api.planDetail(String(id)) : null), [id ? String(id) : '']);
  const [prices, setPrices] = useState<Record<3 | 24, string> | null | undefined>(undefined);
  const [hours, setHours] = useState<3 | 24>(3);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      if (uid) await initPurchases(uid).catch(() => {});
      const p = await boostPrices();
      if (on) setPrices(p);
    })();
    return () => { on = false; };
  }, [uid]);

  if (!id) return <Screen tabs="feed"><BackLink /><StateBlock icon="↑" title={t('boost.noPlan')} copy={t('boost.noPlanCopy')} label={t('plans.feed.myPlans')} onPress={() => router.replace('/my-plans')} /></Screen>;
  if (plan.loading && !plan.data) return <Screen tabs="feed"><Loading /></Screen>;
  if (plan.error || !plan.data) return <Screen tabs="feed"><BackLink /><ErrorBlock message={t('plans.err.generic')} onRetry={plan.reload} /></Screen>;
  const p = plan.data;

  const done = () => { toast(t('boost.done')); router.replace({ pathname: '/plan', params: { id: p.id } }); };
  const buy = async () => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      const r = await buyBoost(hours);
      if (r === 'cancelled') return;
      if (r === 'error') { setFailed(true); return; }
      const until = await syncBoost(p.id);
      if (until) done(); else setFailed(true);
    } finally { setBusy(false); }
  };
  const retrySync = async () => {
    setBusy(true);
    try { const until = await syncBoost(p.id); if (until) done(); else toast(t('boost.err')); } finally { setBusy(false); }
  };
  const free = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.planBoostFree(p.id);
      if (uid) await refreshTier(uid);
      done();
    } catch (e) { toast(toAppError(e).code === 'P0005' ? t('boost.freeNext', { date: tier?.boost_free_at ? formatDate(tier.boost_free_at) : '' }) : t('plans.err.generic')); }
    finally { setBusy(false); }
  };

  const opts: { h: 3 | 24; title: string; sub: string }[] = [
    { h: 3, title: t('boost.h3'), sub: t('boost.h3sub') },
    { h: 24, title: t('boost.h24'), sub: t('boost.h24sub') },
  ];
  return (
    <Screen tabs="feed">
      <BackLink />
      <Title kicker={t('boost.kicker')} heading={t('boost.h')} sub={t('boost.sub')} />
      {opts.map((o) => (
        <Tappable key={o.h} onPress={() => setHours(o.h)} label={o.title} style={[s.opt, hours === o.h && s.optOn]}>
          <View style={s.between}>
            <Text style={s.optH}>{o.title}</Text>
            <Text style={s.price}>{prices ? prices[o.h] : '—'}</Text>
          </View>
          <Text style={s.sub}>{o.sub}</Text>
        </Tappable>
      ))}
      {tier?.plus ? (
        <DarkCard style={{ padding: 14, gap: 6 }}>
          <Text style={s.plusH}>{t('boost.plus')}</Text>
          {tier.boost_free_ready
            ? <Btn kind="secondary" label={t('boost.free')} busy={busy} onPress={free} />
            : <Text style={s.plusSub}>{t('boost.freeNext', { date: tier.boost_free_at ? formatDate(tier.boost_free_at) : '' })}</Text>}
        </DarkCard>
      ) : (
        <View style={s.soft}>
          <Text style={s.softH}>{t('boost.plus')}</Text>
          <Tiny>{t('boost.plusSub')}</Tiny>
          <Btn kind="ghost" label={t('boost.more')} onPress={() => router.push('/plans')} />
        </View>
      )}
      {prices ? (
        <Btn label={t('boost.cta', { price: prices[hours] })} busy={busy} onPress={buy} />
      ) : prices === undefined ? <Loading /> : <Tiny>{purchasesAvailable() ? t('plus.storeError') : t('boost.unavailable')}</Tiny>}
      {failed ? (
        <View style={s.soft}>
          <Text style={s.softH}>{t('boost.err')}</Text>
          <Tiny>{t('boost.errCopy')}</Tiny>
          <Btn kind="secondary" label={t('purchase.retry')} busy={busy} onPress={retrySync} />
        </View>
      ) : null}
      <Tiny>{t('boost.note')}</Tiny>
    </Screen>
  );
}

const s = StyleSheet.create({
  opt: { padding: 14, borderRadius: 17, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, gap: 3 },
  optOn: { borderColor: colors.red, backgroundColor: colors.redWash },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optH: { fontSize: 15, fontWeight: '800', color: colors.ink },
  price: { fontSize: 15, fontWeight: '800', color: colors.redDark },
  sub: { fontSize: 11, color: colors.sub },
  soft: { padding: 14, borderRadius: 17, backgroundColor: colors.redWash, gap: 4 },
  softH: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  plusH: { fontSize: 12.5, fontWeight: '800', color: '#fff' },
  plusSub: { fontSize: 11, color: '#CFC9C1' },
});
