import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 22 · Проверка · одобрена
export default function VerificationApproved() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <StateBlock icon="✓" title={t('screens.verificationApproved.fotoPodtverzhdeno')} copy={t('screens.verificationApproved.podtverzhdeniePomogaetOtse')} label={t('screens.verificationApproved.otkrytProfil')} onPress={() => router.navigate('/me')} />
    </Screen>
  );
}
