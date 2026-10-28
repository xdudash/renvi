import { router } from 'expo-router';
import { BackLink, Btn, SafeBanner, Screen, Title } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 23 · Проверка · отклонена
export default function VerificationRejected() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker={t('screens.verificationRejected.proverkaFoto')} heading={t('screens.verificationRejected.nuzhnoDrugoeSelfi')} sub={t('screens.verificationRejected.litsoDolzhnoBytHorosho')} />
      <SafeBanner>{t('screens.verificationRejected.fotoProfilyaNeMenyaetsya')}</SafeBanner>
      <Btn label={t('screens.verificationRejected.povtoritProverku')} onPress={() => router.push('/ob-verify')} />
      <Btn kind="ghost" label={t('screens.verificationRejected.svyazatsyaSPodderzhkoy')} onPress={() => router.push('/support-help')} />
    </Screen>
  );
}
