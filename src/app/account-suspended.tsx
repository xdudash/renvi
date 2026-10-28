import { Text } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Screen, StateBlock } from '@/components/ui';
import { useSession } from '@/lib/session';

// 93 · Временная приостановка
export default function AccountSuspended() {
  const { profile } = useSession();
  const until = profile?.suspended_until ? new Date(profile.suspended_until).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Screen>
      <StateBlock icon="Ⅱ" title="Аккаунт временно ограничен" copy="Покажем причину, срок, доступные функции и способ связаться с поддержкой." label="Проверить статус" onPress={() => router.push('/support-help')} />
      {until ? <Card tight><Text style={{ fontSize: 12 }}>Ограничение действует до {until}. Вы можете скачать копию данных и обратиться в поддержку.</Text></Card> : null}
      <Btn kind="ghost" label="Попросить пересмотр" onPress={() => router.push('/appeal')} />
    </Screen>
  );
}
