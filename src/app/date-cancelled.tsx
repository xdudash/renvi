import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Screen, Title } from '@/components/ui';

// 62 · Отменено
export default function DateCancelled() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker="ПРИГЛАШЕНИЕ ОТМЕНЕНО" heading="План больше не активен" sub="История приглашения останется в диалоге, но уведомления не повторятся." />
      <Card><Chip label="ОТМЕНЕНО" /></Card>
      <Btn label="Вернуться в чат" onPress={toChat} />
    </Screen>
  );
}
