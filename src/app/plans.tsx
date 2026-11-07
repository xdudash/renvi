import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Eyebrow, Lede, LinkBtn, Loading, Screen, Segmented, Tiny } from '@/components/ui';
import { DarkCard } from '@/components/Kit';
import { useMyTier } from '@/lib/tier';
import { initPurchases, plusOffers, purchasesAvailable, type PlusOffer, type PlusPeriod } from '@/lib/purchases';
import { formatDate } from '@/lib/plans';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plans · RENVI Plus: what it adds, the two prices from the store, the purchase itself runs on purchase-state.
export default function Plans() {
  const { t } = useLang();
  const { uid, tier, loading, error, reload } = useMyTier();
  const [offers, setOffers] = useState<PlusOffer[] | null | undefined>(undefined);
  const [period, setPeriod] = useState<PlusPeriod>('monthly');

  useEffect(() => {
    let on = true;
    (async () => {
      if (uid) await initPurchases(uid).catch(() => {});
      const o = await plusOffers();
      if (on) setOffers(o);
    })();
    return () => { on = false; };
  }, [uid]);

  if (loading && !tier) return <Screen><BackLink onPress={() => router.replace('/me')} /><Loading /></Screen>;
  if (error && !tier) return <Screen><BackLink onPress={() => router.replace('/me')} /><Card><Lede>{t('plans.err.generic')}</Lede><Btn label={t('purchase.retry')} onPress={reload} /></Card></Screen>;

  const offer = offers?.find((o) => o.period === period) ?? offers?.[0];
  const free = tier?.free_sparks ?? 20;
  const rows: [string, string, string][] = [
    [t('plus.row.ads'), t('plus.row.adsFree'), t('plus.row.adsPlus')],
    [t('plus.row.sparks'), String(free), '∞'],
    [t('plus.row.plans'), String(tier?.free_plans ?? 2), '10'],
    [t('plus.row.boost'), t('plus.row.boostFree'), t('plus.row.boostPlus')],
    [t('plus.row.guides'), t('plus.row.guidesFree'), t('plus.row.guidesPlus')],
  ];
  const trial = offer?.trialDays ?? null;
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/me')} />
      <DarkCard style={{ padding: 20 }}>
        <Eyebrow>{t('plus.kicker')}</Eyebrow>
        <Text style={s.h}>{t('plus.h')}</Text>
        <Text style={s.sub}>{t('plus.cancelNote')}</Text>
      </DarkCard>

      {tier?.plus ? (
        <Card>
          <Text style={s.activeH}>{t('plus.activeH')}</Text>
          <Tiny>{tier.trial ? t('plus.activeTrial', { date: formatDate(tier.expires_at ?? '') }) : t('plus.activeUntil', { date: formatDate(tier.expires_at ?? '') })}</Tiny>
          <LinkBtn label={t('purchase.manage')} onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {})} />
        </Card>
      ) : null}

      {!tier?.plus && offers && offers.length > 1 ? (
        <Segmented
          value={offer?.period ?? 'monthly'}
          onChange={(k) => setPeriod(k as PlusPeriod)}
          items={offers.map((o) => ({ key: o.period, label: o.period === 'monthly' ? t('plus.month', { price: o.price }) : t('plus.year', { price: o.price }) }))}
        />
      ) : null}
      {!tier?.plus && offer?.period === 'yearly' && offer.perMonth ? <Tiny center>{t('plus.yearPerMonth', { price: offer.perMonth })}</Tiny> : null}

      <View style={s.table} accessibilityRole="summary">
        <View style={s.tr}>
          <Text style={[s.td, s.th, { flex: 1.6 }]}>{t('plus.cmp.what')}</Text>
          <Text style={[s.td, s.th]}>{t('plus.cmp.free')}</Text>
          <Text style={[s.td, s.th]}>{t('plus.cmp.plus')}</Text>
        </View>
        {rows.map(([a, b, c]) => (
          <View key={a} style={s.tr}>
            <Text style={[s.td, { flex: 1.6, color: colors.ink }]}>{a}</Text>
            <Text style={[s.td, { color: colors.sub }]}>{b}</Text>
            <Text style={[s.td, { fontWeight: '800', color: colors.green }]}>{c}</Text>
          </View>
        ))}
      </View>
      <Tiny center>{t('plus.freeStays')}</Tiny>

      {tier?.plus ? null : offers === undefined ? <Loading /> : offer ? (
        <>
          <Btn label={trial ? t('plus.ctaTrial', { n: trial }) : t('plus.cta', { price: offer.price })} onPress={() => router.push({ pathname: '/purchase-state', params: { mode: 'buy', period: offer.period } })} />
          <Tiny center>{trial ? t('plus.afterTrial', { price: offer.price }) : t('plus.cancelNote')}</Tiny>
        </>
      ) : (
        <Card><Tiny>{purchasesAvailable() ? t('plus.storeError') : t('plus.unavailable')}</Tiny></Card>
      )}

      {purchasesAvailable() ? <Btn kind="ghost" label={t('plus.restore')} onPress={() => router.push({ pathname: '/purchase-state', params: { mode: 'restore' } })} /> : null}
      <Tiny>{t('plus.legal')}</Tiny>
      <LinkBtn label={t('plus.terms')} onPress={() => router.push('/legal')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 24, fontWeight: '900', letterSpacing: -1, lineHeight: 27, color: '#fff', marginTop: 6 },
  sub: { fontSize: 11, color: '#CFC9C1', marginTop: 6 },
  activeH: { fontSize: 15, fontWeight: '800', color: colors.green },
  table: { marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  td: { flex: 1, fontSize: 11.5, textAlign: 'left' },
  th: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1, color: colors.eyebrow },
});
