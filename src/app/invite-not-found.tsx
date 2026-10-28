import { router } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock } from '@/components/ui';

// 09 · Ссылка недействительна
export default function InviteNotFound() {
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/')} />
      <StateBlock icon="⌁" title="Приглашение не найдено" copy="Попросите отправителя проверить ссылку. Если она верна — обратитесь в поддержку." label="На главную" onPress={() => router.replace('/')} />
      <Btn kind="ghost" label="Поддержка" onPress={() => router.push('/support-help')} />
    </Screen>
  );
}
