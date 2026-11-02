import { AnalyticsConsent } from '@/components/AnalyticsConsent';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Bold, Btn, Card, Screen, Tiny } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// 20 · Проверка вручную. Compact on purpose: everything fits on one iPhone screen without scrolling.
export default function ObReview() {
  const { t } = useLang();
  const { profile } = useSession();
  const { save, busy } = useStepSave('ob-review');
  // The selfie step can be skipped (ob-verify); then there is nothing under review yet.
  const skipped = (profile?.verification_status ?? 'none') === 'none';
  return (
    <Screen>
      <OnbHeader
        step={10}
        kicker={t('screens.obReview.proverka')}
        heading={t(skipped ? 'screens.obReview.skippedTitle' : 'screens.obReview.selfiOtpravleno')}
        sub={t(skipped ? 'screens.obReview.skippedSub' : 'screens.obReview.pokaModeratorProveryaetFot')}
      />
      {skipped ? null : (
        <Card tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 26, color: colors.red }}>◷</Text>
          <View style={{ flex: 1 }}>
            <Bold>{t('screens.obReview.obychnoNeskolkoMinut')}</Bold>
            <Tiny>{t('screens.obReview.myPokazhemStatusZdes')}</Tiny>
          </View>
        </Card>
      )}
      <AnalyticsConsent compact />
      <Btn label={t('screens.obReview.prodolzhitOformlenie')} busy={busy} onPress={() => save({})} />
      <Btn kind="ghost" label={t('screens.obReview.chtoProveryaetsya')} onPress={() => router.push('/safety')} />
    </Screen>
  );
}
