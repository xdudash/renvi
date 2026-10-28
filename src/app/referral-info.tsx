import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';

// 83 · Условия приглашения
export default function ReferralInfo() {
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="ПРИГЛАШЕНИЯ" heading="Как работает программа" sub="Никакого доступа к контактам без вашего действия." />
      <Card>
        <Text style={{ fontSize: 13, lineHeight: 20 }}>{'1. Вы отправляете личную ссылку человеку.\n\n2. Он устанавливает приложение и проходит регистрацию.\n\n3. После подтверждения профиля прогресс обновится.\n\n4. Награда показывается в приложении с условиями и датой начисления.'}</Text>
      </Card>
      <Btn label="Понятно" onPress={() => router.back()} />
    </Screen>
  );
}
