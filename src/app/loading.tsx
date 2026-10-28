import { Screen, Title } from '@/components/ui';
import { LoadingCards } from '@/components/LoadingCards';
import { useLang } from '@/lib/lang';

// 90 · Загрузка
export default function LoadingScreen() {
  const { t } = useLang();
  return (
    <Screen tabs="discover">
      <Title kicker={t('screens.loading.podbor')} heading={t('screens.loading.ischemLyudeyRyadom')} sub={t('screens.loading.etoObychnoZanimaetParu')} />
      <LoadingCards />
    </Screen>
  );
}
