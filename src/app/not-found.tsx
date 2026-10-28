import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';

// 91 · Профиль не найден / устаревшая ссылка
export default function NotFoundScreen() {
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/')} />
      <StateBlock icon="↗" title="Эта ссылка устарела" copy="Приглашение могло быть отменено или уже использовано. Попросите друга отправить новую ссылку." label="На главную" onPress={() => router.replace('/')} />
    </Screen>
  );
}
