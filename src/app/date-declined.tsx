import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Screen, Title } from '@/components/ui';
import { resetDateDraft } from '@/lib/dateDraft';

// 61 · Другое время / отказ
export default function DateDeclined() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker="ПЛАН ИЗМЕНИЛСЯ" heading="Ничего страшного" sub="Можно предложить другое время или продолжить разговор без планов." />
      <Card><Chip label="НЕ ПРИНЯТО" /><Text style={{ fontSize: 13, marginTop: 6 }}>Собеседник пока не готов к этому плану.</Text></Card>
      <Btn label="Предложить другое время" onPress={() => { resetDateDraft(match); router.replace({ pathname: '/date-create', params: { match } }); }} />
      <Btn kind="ghost" label="Вернуться к чату" onPress={toChat} />
    </Screen>
  );
}
