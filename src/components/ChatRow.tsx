import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from './ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { api, type MatchRow } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

export function ChatRow({ m, sub }: { m: MatchRow; sub?: string }) {
  const { t } = useLang();
  // list_matches returns the partner's cover photo (0030); the per-row profile_card call is only a fallback for an
  // older database (it made the chat list one request per conversation).
  const fromList = m.partner_photo !== undefined;
  const card = useAsync(() => (fromList ? Promise.resolve(null) : api.profileCard(m.partner_id)), [m.partner_id, fromList]);
  const url = useSignedUrl(fromList ? m.partner_photo : card.data?.photos[0]?.path);
  const verified = fromList ? !!m.partner_verified : !!card.data?.verified;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/chat', params: { match: m.match_id } })} style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Avatar uri={url} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>{m.partner_name}, {m.partner_age} {verified ? '✓' : ''}</Text>
        <Text numberOfLines={1} style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{sub ?? (m.last_body ?? t('components.chatRow.recentMatch'))}{m.muted ? t('components.chatRow.muted') : ''}</Text>
      </View>
      {m.unread > 0 ? <View style={{ backgroundColor: colors.redWash, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 }}><Text style={{ fontSize: 9, color: colors.redDark }}>{m.unread}</Text></View> : <Text style={{ color: '#aaa' }}>›</Text>}
    </Pressable>
  );
}
