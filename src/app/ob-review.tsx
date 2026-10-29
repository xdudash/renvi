import { AnalyticsConsent } from '@/components/AnalyticsConsent';
import { router } from 'expo-router';
import { Btn, Screen, StateBlock } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { useLang } from '@/lib/lang';

// 20 · Проверка вручную
export default function ObReview() {
  const { t } = useLang();
  const { save, busy } = useStepSave('ob-review');
  return (
    <Screen>
      <OnbHeader step={10} kicker={t('screens.obReview.proverka')} heading={t('screens.obReview.selfiOtpravleno')} sub={t('screens.obReview.pokaModeratorProveryaetFot')} />
      <StateBlock icon="◷" title={t('screens.obReview.obychnoNeskolkoMinut')} copy={t('screens.obReview.myPokazhemStatusZdes')} />
      <AnalyticsConsent />
      <Btn label={t('screens.obReview.prodolzhitOformlenie')} busy={busy} onPress={() => save({})} />
      <Btn kind="ghost" label={t('screens.obReview.chtoProveryaetsya')} onPress={() => router.push('/safety')} />
    </Screen>
  );
}
