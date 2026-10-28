import { Screen, Title } from '@/components/ui';
import { LoadingCards } from '@/components/LoadingCards';

// 90 · Загрузка
export default function LoadingScreen() {
  return (
    <Screen tabs="discover">
      <Title kicker="ПОДБОР" heading="Ищем людей рядом" sub="Это обычно занимает пару секунд." />
      <LoadingCards />
    </Screen>
  );
}
