import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 21 · Проверка · ожидает
export default function VerificationPending() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <StateBlock icon="◷" title={t('screens.verificationPending.title')} copy={t('screens.verificationPending.copy')} label={t('screens.verificationPending.ok')} onPress={() => router.navigate('/me')} />
    </Screen>
  );
}
