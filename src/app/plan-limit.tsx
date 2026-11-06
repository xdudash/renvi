import { View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Eyebrow, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// plan-limit · Free accounts hold two active plans at once (the server enforces it).
export default function PlanLimit() {
  const { t } = useLang();
  return (
    <Screen tabs="feed">
      <BackLink onPress={() => router.replace('/feed')} />
      <StateBlock icon="2/2" title={t('plans.limit.h', { n: 2 })} copy={t('plans.limit.copy')} />
      <View style={{ alignItems: 'center' }}><Eyebrow>{t('plans.limit.kicker')}</Eyebrow></View>
      <Btn kind="secondary" label={t('plans.feed.myPlans')} onPress={() => router.replace('/my-plans')} />
    </Screen>
  );
}
