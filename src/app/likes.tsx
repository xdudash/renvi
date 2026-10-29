import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Bold, Card, Loading, Screen, Segmented, Tiny, Title } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { api, type IncomingSpark } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 35–37 · Входящие искры: who sparked you, open to everyone (RENVI has no paid plans)
export default function Likes() {
  const { t } = useLang();
  const [seg, setSeg] = useState('new');
  const { data, loading, error, reload } = useAsync(() => api.incoming(), []);
  const matches = useAsync(() => api.matches(), []);
  const count = data?.count ?? 0;

  if (loading) return <Screen tabs="likes"><Loading /></Screen>;
  if (error) return <Screen tabs="likes"><ErrorRetryState onRetry={reload} /></Screen>;

  const items = data?.items ?? [];
  return (
    <Screen tabs="likes">
      <Title kicker={t('screens.likes.kicker')} heading={t('screens.likes.heading')} sub={t('screens.likes.sub')} />
      <Segmented items={[{ key: 'new', label: t('screens.likes.segNew', { count }) }, { key: 'matches', label: t('screens.likes.segMatches') }]} value={seg} onChange={setSeg} />
      <Card>
        {seg === 'new'
          ? items.length ? items.map((it) => <IncomingRow key={it.profile_id} it={it} />) : <Tiny>{t('screens.likes.noNew')}</Tiny>
          : (matches.data ?? []).length ? (matches.data ?? []).map((m) => (
              <Pressable key={m.match_id} accessibilityRole="button" onPress={() => router.push({ pathname: '/chat', params: { match: m.match_id } })} style={{ paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Bold>{m.partner_name}, {m.partner_age}</Bold><Text style={{ color: '#aaa' }}>›</Text>
              </Pressable>
            )) : <Tiny>{t('screens.likes.noMatches')}</Tiny>}
      </Card>
    </Screen>
  );
}

function IncomingRow({ it }: { it: IncomingSpark }) {
  const { t } = useLang();
  const card = useAsync(() => api.profileCard(it.profile_id), [it.profile_id]);
  const url = useSignedUrl(card.data?.photos[0]?.path);
  const what = it.target_kind === 'prompt' ? t('screens.likes.sparkOnPrompt') : it.target_kind === 'photo' ? t('screens.likes.sparkOnPhoto') : t('screens.likes.spark');
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/incoming-profile', params: { id: it.profile_id } })} style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Avatar uri={url} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>{it.name}, {it.age} {card.data?.verified ? '✓' : ''}</Text>
        <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{it.city} · {what}</Text>
      </View>
      <Text style={{ color: '#aaa' }}>›</Text>
    </Pressable>
  );
}
