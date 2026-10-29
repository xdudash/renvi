import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Between, Btn, Chip, Line, LinkBtn, Screen, Segmented, Tiny, Title } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { useAsync } from '@/hooks/useAsync';
import { loadOffers } from '@/lib/purchases';
import { setPlanChoice } from '@/lib/planChoice';
import { canContinue, periodOfProduct } from '@/lib/billing';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 79 · Подписка
export default function Plans() {
  const { t } = useLang();
  const { tier, productId } = useSession();
  // The user's own pick; until they choose, the toggle shows the period of their current plan.
  const [periodChoice, setPeriod] = useState<'month' | 'year' | null>(null);
  const [selected, setSelected] = useDraft<'free' | 'plus' | 'premium'>(tier);
  const offers = useAsync(() => loadOffers().catch(() => []), []);
  // Period of the current paid plan, from the server product id; null when free or not matched to an offer.
  const currentPeriod = tier === 'free' ? null : periodOfProduct(productId, offers.data ?? []);
  const period: 'month' | 'year' = periodChoice ?? currentPeriod ?? 'month';
  const isCurrent = (id: 'free' | 'plus' | 'premium') => tier === id && (id === 'free' || currentPeriod == null || currentPeriod === period);
  const limitsAll = useAsync(() => api.config<Record<string, any>>('tier_limits'), []);
  const L = limitsAll.data ?? {};
  const price = (tier2: 'plus' | 'premium') => offers.data?.find((o) => o.tier === tier2 && o.period === period)?.price ?? t('screens.plans.storePrice');
  const card = (id: 'free' | 'plus' | 'premium', title: string, lines: [string, string]) => {
    const active = selected === id;
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSelected(id)}
        style={{ borderWidth: active ? 1.5 : 1, borderColor: active ? colors.red : colors.line, borderRadius: 18, padding: 14, marginVertical: 8, backgroundColor: colors.white }}>
        <Between><Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.9 }}>{title}</Text>{isCurrent(id) ? <Chip label={t('screens.plans.current')} tone="red" /> : active ? <Chip label={t('screens.plans.selected')} tone="red" /> : null}</Between>
        {id !== 'free' ? <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>{price(id)} <Text style={{ fontSize: 10, color: colors.muted }}>/ {period === 'month' ? t('screens.plans.perMonth') : t('screens.plans.perYear')}</Text></Text> : <Tiny>{lines[0]}</Tiny>}
        <Line />
        <Tiny>{id === 'free' ? lines[1] : lines[0]}</Tiny>
      </Pressable>
    );
  };
  const go = () => {
    if (selected === 'free') { router.back(); return; }
    if (!canContinue(selected, tier, currentPeriod, period)) return;
    setPlanChoice({ tier: selected, period });
    router.push({ pathname: '/purchase-state', params: { action: 'buy' } });
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="RENVI PLUS / PREMIUM" heading={t('screens.plans.heading')} sub={t('screens.plans.sub')} />
      <Segmented items={[{ key: 'month', label: t('screens.plans.month') }, { key: 'year', label: t('screens.plans.year') }]} value={period} onChange={(k) => setPeriod(k as 'month' | 'year')} />
      {card('free', 'Free', [t('screens.plans.freeLine0', { n: L.free?.daily_likes ?? 20 }), t('screens.plans.freeLine1')])}
      {card('plus', 'RENVI Plus', [t('screens.plans.plusLine0', { n: L.plus?.daily_likes ?? 100 }), ''])}
      {card('premium', 'RENVI Premium', [t('screens.plans.premiumLine0', { n: L.premium?.daily_likes ?? 300 }), ''])}
      <Tiny>{t('screens.plans.legal')}</Tiny>
      <Btn label={t('screens.plans.continue')} disabled={!canContinue(selected, tier, currentPeriod, period)} onPress={go} />
      <Btn kind="ghost" label={t('screens.plans.restore')} onPress={() => router.push({ pathname: '/purchase-state', params: { action: 'restore' } })} />
      <View><LinkBtn label={t('screens.plans.terms')} onPress={() => router.push('/legal')} /></View>
    </Screen>
  );
}
