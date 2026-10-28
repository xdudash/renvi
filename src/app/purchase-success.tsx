import { router } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock } from '@/components/ui';

// 81 · Покупка подтверждена
export default function PurchaseSuccess() {
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <StateBlock icon="✓" title="План обновлён" copy="Преимущества уровня появятся после подтверждения App Store. Настроить продление можно в любое время." label="К знакомствам" onPress={() => router.replace('/discover')} />
      <Btn kind="ghost" label="Управлять подпиской" onPress={() => router.replace('/purchase-state')} />
    </Screen>
  );
}
