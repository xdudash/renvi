// "Видеозвонок перед встречей" on the date screens; hidden when the server has no Daily key configured.
import { router } from 'expo-router';
import { Btn } from '@/components/ui';
import { useLang } from '@/lib/lang';
import { useVideoAvailable } from '@/lib/video';

export function VideoCallButton({ match }: { match?: string }) {
  const { t } = useLang();
  const available = useVideoAvailable();
  if (!match || available !== true) return null;
  return <Btn kind="tertiary" label={t('video.actionA11y')} onPress={() => router.push({ pathname: '/video-call', params: { match } })} />;
}
