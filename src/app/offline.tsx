import { router } from 'expo-router';
import { Screen } from '@/components/ui';
import { OfflineState } from '@/components/States';

// 33 · Нет сети
export default function Offline() {
  return <Screen tabs="discover"><OfflineState onRetry={() => router.replace('/error-retry')} /></Screen>;
}
