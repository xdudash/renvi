import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, ErrorBlock, Eyebrow, Loading, Screen, StateBlock } from '@/components/ui';
import { StepList } from '@/components/Kit';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import type { Plan } from '@/lib/plans';

// plan-join · request sent (or joined at once when the host accepts everyone) and what happens next.
export default function PlanJoin() {
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plan, loading, error, reload } = useAsync<Plan>(() => api.planDetail(String(id)), [String(id)]);
  if (loading && !plan) return <Screen tabs="feed"><Loading /></Screen>;
  if (error || !plan) return <Screen tabs="feed"><ErrorBlock message={t('plans.err.generic')} onRetry={reload} /></Screen>;
  const joined = plan.my_status === 'going';
  return (
    <Screen tabs="feed">
      <StateBlock icon="✓" title={plan.title} copy={t('plans.join.next')} />
      <View style={{ alignItems: 'center' }}><Eyebrow>{joined ? t('plans.join.kickerIn') : t('plans.join.kicker')}</Eyebrow></View>
      <Card><StepList items={[joined ? t('plans.d.goingNow') : t('plans.join.s1'), t('plans.join.s2'), t('plans.join.s3')]} /></Card>
      {joined ? <Btn label={t('plans.d.openChat')} onPress={() => router.replace({ pathname: '/plan-chat', params: { id: plan.id } })} /> : null}
      <Btn label={t('plans.join.others')} onPress={() => router.replace('/feed')} />
      <Btn kind="secondary" label={t('plans.feed.myPlans')} onPress={() => router.replace('/my-plans')} />
    </Screen>
  );
}
