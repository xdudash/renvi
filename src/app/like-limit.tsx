import { router } from 'expo-router';
import { BackLink, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 32 · Дневной лимит искр (anti-abuse, the same for everyone; no upgrade offer — RENVI has no paid plans)
export default function LikeLimit() {
  const { t } = useLang();
  return (
    <Screen tabs="discover">
      <BackLink />
      <StateBlock icon="♡" title={t('screens.likeLimit.title')} copy={t('screens.likeLimit.copy')} label={t('screens.likeLimit.back')} onPress={() => router.navigate('/discover')} />
    </Screen>
  );
}
