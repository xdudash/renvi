import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, Title, useToast } from '@/components/ui';
import { useChat } from '@/lib/chat';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

// 48 · Сообщение не отправилось
export default function MessageFailed() {
  const { match, client, body } = useLocalSearchParams<{ match: string; client: string; body?: string }>();
  const { session } = useSession();
  const toast = useToast();
  const chat = useChat(match, session?.user.id);
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="СООБЩЕНИЕ" heading="Сообщение не доставлено" sub="Текст сохранён на устройстве. Нажмите «Повторить», чтобы избежать потери." />
      <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: colors.red, borderRadius: 16, borderBottomRightRadius: 4, padding: 12, marginVertical: 25 }}>
        <Text style={{ color: '#fff', fontSize: 13 }}>{body}</Text>
        <Text style={{ color: '#ffe8e4', fontSize: 10, marginTop: 3 }}>Не отправлено · нажмите для повтора</Text>
      </View>
      <Btn label="Повторить отправку" onPress={async () => { const ok = await chat.retry(client); toast(ok ? 'Повторная отправка выполнена' : 'Снова не получилось'); if (ok) router.back(); }} />
      <Btn kind="ghost" label="Удалить сообщение" onPress={async () => { await chat.discard(client); router.replace({ pathname: '/message-deleted', params: { match } }); }} />
    </Screen>
  );
}
