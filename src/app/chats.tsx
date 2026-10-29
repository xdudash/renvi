import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Eyebrow, Field, Loading, SafeBanner, Screen, Segmented, Title } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { EmptyChats } from '@/components/EmptyChats';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { ChatRow, NewMatchBubble } from '@/components/ChatRow';
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
  // Matches without a single message yet: a strip of avatars on top, like a fresh "who to write to" row.
  const fresh = useMemo(() => (data ?? []).filter((m) => !m.archived && !m.last_body), [data]);
  if (loading) return <Screen tabs="chats"><Loading /></Screen>;
  if (error) return <Screen tabs="chats"><ErrorRetryState onRetry={reload} /></Screen>;
  if (!(data ?? []).length) return <Screen tabs="chats"><EmptyChats /></Screen>;
  return (
    <Screen tabs="chats">
      <Title kicker={t('screens.chats.vashiDialogi')} heading={t('screens.chats.lyudiZaEkranom')} sub={t('screens.chats.snachalaToChtoPomogaet')} />
      <Segmented items={[{ key: 'all', label: t('screens.chats.vse') }, { key: 'archive', label: t('screens.chats.arhiv') }, { key: 'new', label: t('screens.chats.novye') }]} value={seg} onChange={(k) => (k === 'archive' ? router.push('/archive') : setSeg(k))} />
      <Field value={q} onChangeText={setQ} placeholder={t('screens.chats.poiskPoDialogam')} accessibilityLabel={t('screens.chats.poiskPoDialogam')} />
      {fresh.length && !q.trim() ? (
        <View style={{ marginTop: 6, marginBottom: 2 }}>
          <Eyebrow>{t('chats.newMatches')} · {fresh.length}</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {fresh.map((m) => <NewMatchBubble key={m.match_id} m={m} />)}
          </ScrollView>
        </View>
      ) : null}
      <Card style={{ paddingHorizontal: 6, paddingVertical: 6 }}>{list.length ? list.map((m) => <ChatRow key={m.match_id} m={m} />) : <Text style={{ fontSize: 12, color: colors.sub, padding: 9 }}>{t('screens.chats.nichegoNeNaydeno')}</Text>}</Card>
      <SafeBanner>{t('screens.chats.fotografiiVChateOtkryvayut')}</SafeBanner>
    </Screen>
  );
}

