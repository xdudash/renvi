import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Card, Field, Loading, SafeBanner, Screen, Segmented, Title } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { EmptyChats } from '@/components/EmptyChats';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { ChatRow } from '@/components/ChatRow';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 40 · Список диалогов
export default function Chats() {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(() => api.matches(), []);
  useReloadOnFocus(reload); // unread counts / last message after coming back from a conversation
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
      <Title kicker={t('screens.chats.vashiDialogi')} heading={t('screens.chats.lyudiZaEkranom')} sub={t('screens.chats.snachalaToChtoPomogaet')} />
      <Segmented items={[{ key: 'all', label: t('screens.chats.vse') }, { key: 'archive', label: t('screens.chats.arhiv') }, { key: 'new', label: t('screens.chats.novye') }]} value={seg} onChange={(k) => (k === 'archive' ? router.push('/archive') : setSeg(k))} />
      <Field value={q} onChangeText={setQ} placeholder={t('screens.chats.poiskPoDialogam')} accessibilityLabel={t('screens.chats.poiskPoDialogam')} />
      <Card>{list.length ? list.map((m) => <ChatRow key={m.match_id} m={m} />) : <Text style={{ fontSize: 12, color: colors.sub }}>{t('screens.chats.nichegoNeNaydeno')}</Text>}</Card>
      <SafeBanner>{t('screens.chats.fotografiiVChateOtkryvayut')}</SafeBanner>
    </Screen>
  );
}

