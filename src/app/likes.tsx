import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Card, Loading, Screen, Segmented, Tiny, Title, VerifiedBadge } from '@/components/ui';
import { BrandMark } from '@/components/BrandMark';
import { ChatRow } from '@/components/ChatRow';
import { ErrorRetryState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
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
  useReloadOnFocus(() => { reload(); matches.reload(); });
  const count = data?.count ?? 0;

  if (loading) return <Screen tabs="likes"><Loading /></Screen>;
  if (error) return <Screen tabs="likes"><ErrorRetryState onRetry={reload} /></Screen>;

  const items = data?.items ?? [];
  return (
    <Screen tabs="likes">
      <Title kicker={t('screens.likes.kicker')} heading={t('screens.likes.heading')} sub={t('screens.likes.sub')} />
      <Segmented items={[{ key: 'new', label: t('screens.likes.segNew', { count }) }, { key: 'matches', label: t('screens.likes.segMatches') }]} value={seg} onChange={setSeg} />
      {seg === 'new'
        ? items.length ? <View style={st.grid}>{items.map((it) => <IncomingTile key={it.profile_id} it={it} />)}</View> : <Card><Tiny>{t('screens.likes.noNew')}</Tiny></Card>
        : (matches.data ?? []).length
          ? <Card style={{ paddingHorizontal: 6, paddingVertical: 6 }}>{(matches.data ?? []).map((m) => <ChatRow key={m.match_id} m={m} />)}</Card>
          : <Card><Tiny>{t('chats.matchesEmpty')}</Tiny></Card>}
    </Screen>
  );
}

function IncomingTile({ it }: { it: IncomingSpark }) {
  const { t } = useLang();
  // incoming_sparks returns photo + verified (0030); profile_card per row only for an older database.
  const fromList = it.photo !== undefined;
  const card = useAsync(() => (fromList ? Promise.resolve(null) : api.profileCard(it.profile_id)), [it.profile_id, fromList]);
  const url = useSignedUrl(fromList ? it.photo : card.data?.photos[0]?.path);
  const verified = fromList ? !!it.verified : !!card.data?.verified;
  const what = it.target_kind === 'prompt' ? t('screens.likes.sparkOnPrompt') : it.target_kind === 'photo' ? t('screens.likes.sparkOnPhoto') : t('screens.likes.spark');
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/incoming-profile', params: { id: it.profile_id } })} style={st.tile}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.blush }]} />}
      <View style={st.spark}><BrandMark color="#fff" size={14} /></View>
      <LinearGradient colors={['rgba(20,16,14,0)', 'rgba(20,16,14,0.8)']} style={st.shade}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={st.name} numberOfLines={1}>{it.name}, {it.age}</Text>
          {verified ? <VerifiedBadge size={15} /> : null}
        </View>
        <Text style={st.what} numberOfLines={1}>{what}</Text>
        {it.comment ? <Text style={st.comment} numberOfLines={2}>«{it.comment}»</Text> : null}
      </LinearGradient>
    </Pressable>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  tile: { width: '48.4%', aspectRatio: 0.72, borderRadius: 20, overflow: 'hidden', backgroundColor: '#e7e1da' },
  spark: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 11, paddingTop: 40, paddingBottom: 11 },
  name: { flexShrink: 1, color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: -0.4 },
  what: { color: 'rgba(255,255,255,0.88)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  comment: { color: '#fff', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
});
