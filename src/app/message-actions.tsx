import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Choice, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

// 50 · Действия с сообщением
export default function MessageActions() {
  const { match, id, mine, body } = useLocalSearchParams<{ match: string; id: string; mine: string; body?: string }>();
  const toast = useToast();
  const isMine = mine === '1';
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ДОЛГОЕ НАЖАТИЕ" heading="Действия с сообщением" sub="Скопировать, удалить своё сообщение или пожаловаться на чужое." />
      <View style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: isMine ? colors.red : '#EAE6E0', borderRadius: 16, padding: 12, marginTop: 30, marginBottom: 20 }}>
        <Text style={{ color: isMine ? '#fff' : colors.ink, fontSize: 13 }}>{body}</Text>
      </View>
      <Card>
        <Choice onPress={async () => { await Clipboard.setStringAsync(body ?? ''); toast('Текст скопирован'); }}><Text style={{ fontSize: 12 }}>Скопировать текст</Text><Text>›</Text></Choice>
        {isMine ? (
          <Choice onPress={async () => { try { await api.deleteMessage(id); router.replace({ pathname: '/message-deleted', params: { match } }); } catch { toast('Не удалось удалить'); } }}><Text style={{ fontSize: 12 }}>Удалить у себя</Text><Text>›</Text></Choice>
        ) : (
          <Choice onPress={() => router.push({ pathname: '/report', params: { message: id, match } })}><Text style={{ fontSize: 12 }}>Пожаловаться на сообщение</Text><Text>›</Text></Choice>
        )}
      </Card>
      <Btn kind="ghost" label="Отмена" onPress={() => router.back()} />
    </Screen>
  );
}
