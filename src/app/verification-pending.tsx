import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';

// 21 · Проверка · ожидает
export default function VerificationPending() {
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <StateBlock icon="◷" title="Проверка ожидает модератора" copy="После проверки статус появится здесь и в вашей анкете. Значок подтверждения не гарантирует безопасность или достоверность всех данных." label="Понятно" onPress={() => router.navigate('/me')} />
    </Screen>
  );
}
