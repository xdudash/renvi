import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Between, Btn, Card, Chip, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

// 52 · Отключённые уведомления
export default function Muted() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="УВЕДОМЛЕНИЯ" heading="Диалог без уведомлений" sub="Важные сообщения останутся внутри чата." />
      <Card>
        <Between>
          <View><Text style={{ fontWeight: '700', fontSize: 13 }}>Уведомления выключены</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Вы не потеряете переписку</Text></View>
          <Chip label="ПАУЗА" tone="amber" />
        </Between>
      </Card>
      <Btn label="Включить уведомления" onPress={async () => { try { await api.matchSettings(match, { muted: false }); toast('Уведомления включены'); router.replace({ pathname: '/chat', params: { match } }); } catch { toast('Не удалось изменить'); } }} />
    </Screen>
  );
}
