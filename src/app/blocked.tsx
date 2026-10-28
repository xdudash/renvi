import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, BackLink, Btn, Card, LinkBtn, Loading, Screen, Title, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

type BlockedRow = { blocked_id: string; created_at: string };

// 78 · Заблокированные профили
export default function Blocked() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: rows, error } = await supabase.from('blocks').select('blocked_id, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return (rows ?? []) as BlockedRow[];
  }, []);
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/privacy-data')} />
      <Title kicker="ЗАБЛОКИРОВАННЫЕ" heading="Кого вы исключили" sub="Профили из этого списка не увидят вашу анкету и не смогут написать." />
      {loading ? <Loading /> : (
        <Card>
          {(data ?? []).length ? (data ?? []).map((b) => (
            <BlockedItem key={b.blocked_id} row={b} onUnblock={async () => { try { await api.unblock(b.blocked_id); toast('Профиль разблокирован'); reload(); } catch { toast('Не удалось разблокировать'); } }} />
          )) : <Text style={{ fontSize: 12, color: colors.sub }}>Вы никого не блокировали.</Text>}
        </Card>
      )}
      <Btn kind="ghost" label="Вернуться в приватность" onPress={() => router.navigate('/privacy-data')} />
    </Screen>
  );
}

function BlockedItem({ row, onUnblock }: { row: BlockedRow; onUnblock: () => void }) {
  const card = useAsync(() => api.profileCard(row.blocked_id), [row.blocked_id]);
  const url = useSignedUrl(card.data?.photos[0]?.path);
  const when = new Date(row.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 6 }}>
      <Pressable style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 6 }}>
        <Avatar uri={url} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 13 }}>{card.data ? `${card.data.display_name}, ${card.data.age}` : 'Профиль'}</Text>
          <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Заблокирован {when}</Text>
        </View>
      </Pressable>
      <LinkBtn label="Разблокировать" onPress={onUnblock} />
    </View>
  );
}
