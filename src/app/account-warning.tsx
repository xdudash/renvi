import { router } from 'expo-router';
import { Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 92 · Предупреждение аккаунта
export default function AccountWarning() {
  const { t } = useLang();
  return (
    <Screen>
      <StateBlock icon="!" title={t('screens.accountWarning.obratiteVnimanie')} copy={t('screens.accountWarning.myZametiliSobytieTrebuyusc')} label={t('screens.accountWarning.otkrytUvedomlenie')} onPress={() => router.replace('/report-status')} />
    </Screen>
  );
}
