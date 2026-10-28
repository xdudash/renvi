import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Row, Screen, Title, useToast } from '@/components/ui';
import { enablePush } from '@/lib/push';
import { colors } from '@/theme/tokens';

// 43 · Уведомления после совпадения
export default function PushPrompt() {
  const { match } = useLocalSearchParams<{ match?: string }>();
  const toast = useToast();
  const next = () => (match ? router.replace({ pathname: '/chat', params: { match } }) : router.replace('/chats'));
  const enable = async () => {
    const r = await enablePush();
    toast(r === 'ok' ? 'Уведомления включены' : r === 'denied' ? 'Можно включить позже в настройках iOS' : r === 'unsupported' ? 'Уведомления доступны в приложении на телефоне' : 'Не удалось включить уведомления');
    next();
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="НЕ ПРОПУСТИТЕ ОТВЕТ" heading="Хотите получать уведомления?" sub="Включите их, чтобы видеть ответ на сообщение или приглашение. Решение можно изменить позже в iOS Settings." />
      <Card>
        <Row>
          <Text style={{ fontSize: 25, color: colors.red }}>♡</Text>
          <View><Text style={{ fontWeight: '700', fontSize: 13 }}>Только важное</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Сообщения · совпадения · план встречи</Text></View>
        </Row>
      </Card>
      <Btn label="Включить уведомления" onPress={enable} />
      <Btn kind="ghost" label="Не сейчас" onPress={next} />
    </Screen>
  );
}
