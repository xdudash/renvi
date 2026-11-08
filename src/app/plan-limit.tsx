import { View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Eyebrow, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';
import { useMyTier } from '@/lib/tier';
import { purchasesAvailable } from '@/lib/purchases';

// plan-limit · Free accounts hold two active plans at once (the server enforces it).
export default function PlanLimit() {
  const { t } = useLang();
  const { tier } = useMyTier();
  return (
    <Screen tabs="feed">
      <BackLink onPress={() => router.replace('/feed')} />
      <StateBlock icon="2/2" title={t('plans.limit.h', { n: tier?.plan_limit ?? 2 })} copy={t('plans.limit.copy')} />
      <View style={{ alignItems: 'center' }}><Eyebrow>{t('plans.limit.kicker')}</Eyebrow></View>
      {tier && !tier.plus && purchasesAvailable() ? <Btn label={t('plans.limit.plus', { n: 10 })} onPress={() => router.push('/plans')} /> : null}
      <Btn kind="secondary" label={t('plans.feed.myPlans')} onPress={() => router.replace('/my-plans')} />
    </Screen>
  );
}
