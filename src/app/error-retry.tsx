import { router } from 'expo-router';
import { BackLink, Screen } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useDiscover } from '@/lib/discover';

// 34 · Ошибка и повтор
export default function ErrorRetry() {
  const d = useDiscover();
  return (
    <Screen tabs="discover">
      <BackLink />
      <ErrorRetryState onRetry={async () => { await d.load(); router.replace('/discover'); }} />
    </Screen>
  );
}
