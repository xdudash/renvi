import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';
import { colors } from '@/theme/tokens';

// 76 · Удалить аккаунт
export default function DeleteAccount() {
  return (
    <Screen>
      <BackLink />
      <Title kicker="УДАЛЕНИЕ АККАУНТА" heading="Вы уверены, что хотите уйти?" sub="Сначала можно скрыть анкету и сделать паузу. Удаление не используется как тёмный паттерн для удержания." />
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>При удалении:</Text>
        <View style={{ marginTop: 6, gap: 4 }}>
          {['анкета перестанет показываться', 'покупка в App Store должна отменяться отдельно', 'сроки удаления данных указаны в политике приватности'].map((x) => (
            <Text key={x} style={{ fontSize: 10, color: colors.muted }}>•  {x}</Text>
          ))}
        </View>
      </Card>
      <Btn kind="tertiary" label="Сначала скрыть профиль" onPress={() => router.push('/privacy-visibility')} />
      <Btn kind="warn" label="Продолжить удаление" onPress={() => router.push('/delete-confirm')} />
    </Screen>
  );
}
