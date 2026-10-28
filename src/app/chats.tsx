import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Card, Field, Loading, SafeBanner, Screen, Segmented, Title } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { EmptyChats } from '@/components/EmptyChats';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { ChatRow } from '@/components/ChatRow';
import { colors } from '@/theme/tokens';

// 40 · Список диалогов
export default function Chats() {
  const { data, loading, error, reload } = useAsync(() => api.matches(), []);
  const [seg, setSeg] = useState('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const rows = (data ?? []).filter((m) => !m.archived);
    const f = seg === 'new' ? rows.filter((m) => m.unread > 0) : rows;
    const s = q.trim().toLowerCase();
    return (s ? f.filter((m) => m.partner_name.toLowerCase().includes(s) || (m.last_body ?? '').toLowerCase().includes(s)) : f)
      .sort((a, b) => (b.last_at ?? b.created_at).localeCompare(a.last_at ?? a.created_at));
  }, [data, seg, q]);
  if (loading) return <Screen tabs="chats"><Loading /></Screen>;
  if (error) return <Screen tabs="chats"><ErrorRetryState onRetry={reload} /></Screen>;
  if (!(data ?? []).length) return <Screen tabs="chats"><EmptyChats /></Screen>;
  return (
    <Screen tabs="chats">
      <Title kicker="ВАШИ ДИАЛОГИ" heading="Люди за экраном" sub="Сначала — то, что помогает продолжить разговор." />
      <Segmented items={[{ key: 'all', label: 'Все' }, { key: 'archive', label: 'Архив' }, { key: 'new', label: 'Новые' }]} value={seg} onChange={(k) => (k === 'archive' ? router.push('/archive') : setSeg(k))} />
      <Field value={q} onChangeText={setQ} placeholder="Поиск по диалогам" accessibilityLabel="Поиск по диалогам" />
      <Card>{list.length ? list.map((m) => <ChatRow key={m.match_id} m={m} />) : <Text style={{ fontSize: 12, color: colors.sub }}>Ничего не найдено.</Text>}</Card>
      <SafeBanner>Фотографии в чате открываются, когда оба человека разрешат обмен.</SafeBanner>
    </Screen>
  );
}

