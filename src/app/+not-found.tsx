import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 91 · Профиль не найден / устаревшая ссылка
export default function NotFound() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/')} />
      <StateBlock icon="↗" title={t('screens.notFoundPlus.title')} copy={t('screens.notFoundPlus.copy')} label={t('screens.notFoundPlus.home')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
