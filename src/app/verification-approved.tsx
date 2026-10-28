import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';

// 22 · Проверка · одобрена
export default function VerificationApproved() {
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <StateBlock icon="✓" title="Фото подтверждено" copy="Подтверждение помогает оценить профиль, но не является гарантией личности или безопасности." label="Открыть профиль" onPress={() => router.navigate('/me')} />
    </Screen>
  );
}
