import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { VerifiedBadge } from './ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { api, type MatchRow } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { localeOf } from '@/i18n/current';

function usePartnerPhoto(m: MatchRow) {
  // list_matches returns the partner's cover photo (0030); the per-row profile_card call is only a fallback for an
  // older database (it made the chat list one request per conversation).
  const fromList = m.partner_photo !== undefined;
  const card = useAsync(() => (fromList ? Promise.resolve(null) : api.profileCard(m.partner_id)), [m.partner_id, fromList]);
  const url = useSignedUrl(fromList ? m.partner_photo : card.data?.photos[0]?.path);
  const verified = fromList ? !!m.partner_verified : !!card.data?.verified;
  return { url, verified };
}

const when = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(localeOf(), { day: 'numeric', month: 'short' });
};

export function ChatRow({ m, sub }: { m: MatchRow; sub?: string }) {
  const { t } = useLang();
  const { url, verified } = usePartnerPhoto(m);
  const unread = m.unread > 0;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/chat', params: { match: m.match_id } })}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: '#f3efe9' }]}>
      <View style={[s.ring, unread && s.ringOn]}>
        {url ? <Image source={{ uri: url }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: colors.blush }]} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.top}>
          <Text style={[s.name, unread && { fontWeight: '900' }]} numberOfLines={1}>{m.partner_name}, {m.partner_age}</Text>
          {verified ? <VerifiedBadge size={15} /> : null}
          <Text style={[s.time, unread && { color: colors.red, fontWeight: '700' }]}>{when(m.last_at ?? m.created_at)}</Text>
        </View>
        <View style={s.bottom}>
          <Text numberOfLines={1} style={[s.last, unread && { color: colors.ink, fontWeight: '600' }, !m.last_body && { color: colors.red, fontWeight: '700' }]}>
            {sub ?? (m.last_body ?? t('chats.sayHiNeutral'))}{m.muted ? t('components.chatRow.muted') : ''}
          </Text>
          {unread ? <View style={s.badge}><Text style={s.badgeText}>{m.unread}</Text></View> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Round avatar with a red ring for a fresh match (no messages yet), shown in a horizontal strip. */
export function NewMatchBubble({ m }: { m: MatchRow }) {
  const { url, verified } = usePartnerPhoto(m);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${m.partner_name}, ${m.partner_age}`} onPress={() => router.push({ pathname: '/chat', params: { match: m.match_id } })} style={s.bubble}>
      <View style={s.bigRing}>
        {url ? <Image source={{ uri: url }} style={s.bigAvatar} /> : <View style={[s.bigAvatar, { backgroundColor: colors.blush }]} />}
        {verified ? <View style={s.bigBadge}><VerifiedBadge size={18} /></View> : null}
      </View>
      <Text style={s.bubbleName} numberOfLines={1}>{m.partner_name}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 16 },
  ring: { padding: 2, borderRadius: 34, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.red },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontWeight: '800', fontSize: 15, color: colors.ink },
  time: { marginLeft: 'auto', fontSize: 11, color: colors.muted },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  last: { flex: 1, fontSize: 13, color: colors.sub },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bubble: { width: 78, alignItems: 'center', marginRight: 6 },
  bigRing: { padding: 3, borderRadius: 40, borderWidth: 2.5, borderColor: colors.red },
  bigAvatar: { width: 64, height: 64, borderRadius: 32 },
  bigBadge: { position: 'absolute', right: 0, bottom: 0 },
  bubbleName: { marginTop: 6, fontSize: 12, fontWeight: '700', color: colors.ink, maxWidth: 74 },
});
