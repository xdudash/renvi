import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Loading, Screen, Title, useToast } from '@/components/ui';
import { ChatRow } from '@/components/ChatRow';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

// 51 · Архив диалогов
export default function Archive() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.matches(), []);
  const rows = (data ?? []).filter((m) => m.archived);
  return (
    <Screen tabs="chats">
      <BackLink onPress={() => router.navigate('/chats')} />
      <Title kicker="АРХИВ" heading="Скрытые диалоги" sub="Диалог можно вернуть в список в любое время." />
      {loading ? <Loading /> : (
        <Card>{rows.length ? rows.map((m) => <ChatRow key={m.match_id} m={m} sub="Архивирован" />) : <Text style={{ fontSize: 12, color: colors.sub }}>В архиве пусто.</Text>}</Card>
      )}
      {rows.length ? (
        <Btn kind="secondary" label="Вернуть в чаты" onPress={async () => {
          try { await Promise.all(rows.map((m) => api.matchSettings(m.match_id, { archived: false }))); toast('Диалоги возвращены'); reload(); router.navigate('/chats'); } catch { toast('Не удалось вернуть'); }
        }} />
      ) : null}
    </Screen>
  );
}
