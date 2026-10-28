import { router } from 'expo-router';
import { Screen, StateBlock } from '@/components/ui';

// 92 · Предупреждение аккаунта
export default function AccountWarning() {
  return (
    <Screen>
      <StateBlock icon="!" title="Обратите внимание" copy="Мы заметили событие, требующее внимания. Причина и дальнейшие действия объясняются простым языком." label="Открыть уведомление" onPress={() => router.replace('/report-status')} />
    </Screen>
  );
}
