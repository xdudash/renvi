import { Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, ErrorBlock, Eyebrow, Loading, Screen, StateBlock, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { inviteUrl } from '@/lib/referral';
import { useLang } from '@/lib/lang';
import type { Plan } from '@/lib/plans';

// plan-created · the plan is published; the host can invite friends with a link or open the requests.
export default function PlanCreated() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plan, loading, error, reload } = useAsync<Plan>(() => api.planDetail(String(id)), [String(id)]);
  if (loading && !plan) return <Screen tabs="feed"><Loading /></Screen>;
  if (error || !plan) return <Screen tabs="feed"><ErrorBlock message={t('plans.err.generic')} onRetry={reload} /></Screen>;
  const url = `${inviteUrl('').replace(/\/invite\/$/, '')}/plan?id=${plan.id}`;
  return (
    <Screen tabs="feed">
      <StateBlock icon="✓" title={plan.title} copy={t('plans.created.copy')} />
      <View style={{ alignItems: 'center' }}><Eyebrow>{t('plans.created.kicker')}</Eyebrow></View>
      <Btn kind="secondary" label={t('plans.created.share')} onPress={() => Share.share({ message: t('plans.shareText', { title: plan.title, url }) }).catch(() => toast(t('plans.err.generic')))} />
      <Btn label={t('plans.created.open')} onPress={() => router.replace({ pathname: '/plan-requests', params: { id: plan.id } })} />
    </Screen>
  );
}
