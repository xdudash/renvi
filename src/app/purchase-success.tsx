import { router } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 81 · Покупка подтверждена
export default function PurchaseSuccess() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <StateBlock icon="✓" title={t('screens.purchaseSuccess.planObnovlen')} copy={t('screens.purchaseSuccess.preimuschestvaUrovnyaPoyav')} label={t('screens.purchaseSuccess.kZnakomstvam')} onPress={() => router.replace('/discover')} />
      <Btn kind="ghost" label={t('screens.purchaseSuccess.upravlyatPodpiskoy')} onPress={() => router.replace('/purchase-state')} />
    </Screen>
  );
}
