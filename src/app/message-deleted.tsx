import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, Title } from '@/components/ui';
import { colors } from '@/theme/tokens';

// 49 · Удалённое сообщение
export default function MessageDeleted() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const back = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={back} />
      <Title kicker="ДИАЛОГ" heading="Сообщение удалено" sub="Другой человек увидит аккуратную отметку вместо текста." />
      <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12 }}>
        <Text style={{ fontSize: 10, color: '#7d7971' }}>Вы удалили сообщение</Text>
      </View>
      <Btn label="Вернуться в диалог" onPress={back} />
    </Screen>
  );
}
