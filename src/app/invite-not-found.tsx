import { router } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 09 · Ссылка недействительна
export default function InviteNotFound() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/')} />
      <StateBlock icon="⌁" title={t('screens.inviteNotFound.title')} copy={t('screens.inviteNotFound.copy')} label={t('screens.inviteNotFound.home')} onPress={() => router.replace('/')} />
      <Btn kind="ghost" label={t('screens.inviteNotFound.support')} onPress={() => router.push('/support-help')} />
    </Screen>
  );
}
