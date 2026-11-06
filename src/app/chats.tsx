import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Eyebrow, Field, Loading, SafeBanner, Screen, Title } from '@/components/ui';
import { FilterChip } from '@/components/Kit';
import { ErrorRetryState } from '@/components/States';
import { EmptyChats } from '@/components/EmptyChats';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { ChatRow, NewMatchBubble, PlanChatRowView } from '@/components/ChatRow';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 40 · Список диалогов: личные и групповые чаты (планы) в одном списке.
type Item = { key: string; at: string; node: ReactNode; kind: 'plans' | 'company' | 'dating' };

export default function Chats() {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(async () => {
    const [m, p] = await Promise.all([api.matches(), api.planChats().catch(() => [])]);
    return { m, p };
  }, []);
  useReloadOnFocus(reload); // unread counts / last message after coming back from a conversation
  const [seg, setSeg] = useState<'all' | 'plans' | 'company' | 'dating'>('all');
  const [q, setQ] = useState('');
  const matches = useMemo(() => data?.m ?? [], [data]);
  const plans = useMemo(() => data?.p ?? [], [data]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const items: Item[] = [];
    for (const m of matches) {
      if (m.archived) continue;
      if (s && !m.partner_name.toLowerCase().includes(s) && !(m.last_body ?? '').toLowerCase().includes(s)) continue;
      const kind = m.kind === 'dating' || !m.kind ? 'dating' : 'company';
      const tag = m.kind === 'company' ? t('chats.tag.company') : m.kind === 'couples' ? t('chats.tag.couples') : undefined;
      items.push({ key: 'm' + m.match_id, at: m.last_at ?? m.created_at, kind, node: <ChatRow m={m} tag={tag} /> });
    }
    for (const p of plans) {
      if (s && !p.title.toLowerCase().includes(s) && !(p.last_body ?? '').toLowerCase().includes(s)) continue;
      items.push({ key: 'p' + p.plan_id, at: p.last_at, kind: 'plans', node: <PlanChatRowView p={p} /> });
    }
    return items.filter((i) => seg === 'all' || i.kind === seg).sort((a, b) => b.at.localeCompare(a.at));
  }, [matches, plans, seg, q, t]);
  // Matches without a single message yet: a strip of avatars on top, like a fresh "who to write to" row.
  const fresh = useMemo(() => matches.filter((m) => !m.archived && !m.last_body), [matches]);
  if (loading) return <Screen tabs="chats"><Loading /></Screen>;
  if (error) return <Screen tabs="chats"><ErrorRetryState onRetry={reload} /></Screen>;
  if (!matches.length && !plans.length) return <Screen tabs="chats"><EmptyChats /></Screen>;
  const chips: { key: typeof seg; label: string }[] = [
    { key: 'all', label: t('chats.f.all') }, { key: 'plans', label: t('chats.f.plans') },
    { key: 'company', label: t('chats.f.company') }, { key: 'dating', label: t('chats.f.dating') },
  ];
  return (
    <Screen tabs="chats">
      <Title kicker={t('chats.kicker')} heading={t('chats.heading')} sub={t('chats.lede')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {chips.map((c) => <FilterChip key={c.key} label={c.label} on={seg === c.key} onPress={() => setSeg(c.key)} />)}
        <FilterChip label={t('chats.f.archive')} onPress={() => router.push('/archive')} />
      </View>
      <Field value={q} onChangeText={setQ} placeholder={t('screens.chats.poiskPoDialogam')} accessibilityLabel={t('screens.chats.poiskPoDialogam')} />
      {fresh.length && !q.trim() && (seg === 'all' || seg === 'dating') ? (
        <View style={{ marginTop: 6, marginBottom: 2 }}>
          <Eyebrow>{t('chats.newMatches')} · {fresh.length}</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {fresh.map((m) => <NewMatchBubble key={m.match_id} m={m} />)}
          </ScrollView>
        </View>
      ) : null}
      <Card style={{ paddingHorizontal: 6, paddingVertical: 6 }}>{list.length ? list.map((i) => <View key={i.key}>{i.node}</View>) : <Text style={{ fontSize: 12, color: colors.sub, padding: 9 }}>{t('screens.chats.nichegoNeNaydeno')}</Text>}</Card>
      <SafeBanner>{t('chats.footer')}</SafeBanner>
    </Screen>
  );
}
