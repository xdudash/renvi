import { router } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 32 · Лимит лайков
export default function LikeLimit() {
  const { t } = useLang();
  return (
    <Screen tabs="discover">
      <BackLink />
      <StateBlock icon="♡" title={t('screens.likeLimit.title')} copy={t('screens.likeLimit.copy')} label={t('screens.likeLimit.plus')} onPress={() => router.push('/plans')} />
      <Btn kind="ghost" label={t('screens.likeLimit.back')} onPress={() => router.navigate('/discover')} />
    </Screen>
  );
}
