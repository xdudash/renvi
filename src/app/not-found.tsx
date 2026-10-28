import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 91 · Профиль не найден / устаревшая ссылка
export default function NotFoundScreen() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/')} />
      <StateBlock icon="↗" title={t('screens.notFound.title')} copy={t('screens.notFound.copy')} label={t('screens.notFound.home')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
