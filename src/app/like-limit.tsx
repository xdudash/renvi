import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Eyebrow, Loading, Screen, StateBlock, Tiny } from '@/components/ui';
import { useMyTier } from '@/lib/tier';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
import { purchasesAvailable } from '@/lib/purchases';

// like-limit · today's sparks are used up. Free: watch a partner ad for more (server-timed), or get Plus (no limit).
export default function LikeLimit() {
  const { t } = useLang();
  const { tier, loading, error, reload } = useMyTier();
  if (loading && !tier) return <Screen tabs="discover"><BackLink /><Loading /></Screen>;
  if (error && !tier) return <Screen tabs="discover"><BackLink /><StateBlock icon="!" title={t('plans.err.generic')} copy="" label={t('purchase.retry')} onPress={reload} /></Screen>;
  const left = tier?.ads_left ?? 0;
  return (
    <Screen tabs="discover">
      <BackLink />
      <StateBlock
        icon="♡"
        title={t('limit.h')}
        copy={t('limit.copy', { n: tier?.spark_limit ?? tier?.free_sparks ?? 20 })}
        secondary={<Eyebrow>{t('limit.kicker')}</Eyebrow>}
      />
      {left > 0 ? (
        <>
          <Btn label={t('limit.watch', { n: tier?.ad_sparks ?? 5 })} onPress={() => router.push('/rewarded-ad')} />
          <Tiny center>{t('limit.watchLeft', { n: left })}</Tiny>
        </>
      ) : <Text style={{ textAlign: 'center', fontSize: 11, color: colors.sub }}>{t('limit.noAds')}</Text>}
      {purchasesAvailable() ? <Btn kind="secondary" label={t('limit.plus')} onPress={() => router.push('/plans')} /> : null}
      <Btn kind="ghost" label={t('limit.plans')} onPress={() => router.replace('/feed')} />
    </Screen>
  );
}
