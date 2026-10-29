import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Between, Bold, Btn, Card, Chip, LinkBtn, Loading, Screen, Segmented, Tiny, Title } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { api, type IncomingSpark } from '@/lib/api';
import { useSession, useTierLimits } from '@/lib/session';
import { colors } from '@/theme/tokens';
import type { TFunction } from '@/i18n';
import { useLang } from '@/lib/lang';

// 35–37 · Входящие · Free / Plus / Premium (one screen; the server decides what the plan may see)
export default function Likes() {
  const { t } = useLang();
  const { tier } = useSession();
  const { limits } = useTierLimits();
  const [seg, setSeg] = useState('new');
  const { data, loading, error, reload } = useAsync(() => api.incoming(), [tier]);
  const matches = useAsync(() => api.matches(), []);
  useReloadOnFocus(() => { reload(); matches.reload(); });
  const count = data?.count ?? 0;

  if (loading) return <Screen tabs="likes"><Loading /></Screen>;
  if (error) return <Screen tabs="likes"><ErrorRetryState onRetry={reload} /></Screen>;

  if (tier === 'free') {
    return (
      <Screen tabs="likes">
        <Title kicker={t('screens.likes.kickerFree')} heading={t('screens.likes.headingFree')} sub={t('screens.likes.subFree')} />
        <View style={{ backgroundColor: colors.redWash, borderRadius: 16, padding: 13 }}>
          <Between><Bold>{t('screens.likes.count', { count, noun: plural(count, t) })}</Bold><Chip label={t('screens.likes.hiddenInFree')} tone="red" /></Between>
          <Tiny>{t('screens.likes.openIncoming')}</Tiny>
          <Btn label={t('screens.likes.viewIncoming')} onPress={() => router.push('/plans')} />
        </View>
        {count > 0 ? (
          <Card>
            {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 11, opacity: 0.35 }} accessibilityLabel={t('screens.likes.hiddenCrush')}>
                <Avatar />
                <View><Bold>{t('screens.likes.newCrush')}</Bold><Text style={{ fontSize: 10, color: colors.sub }}>{t('screens.likes.nearby')}</Text></View>
              </View>
            ))}
          </Card>
        ) : null}
        <Tiny>{t('screens.likes.freeNote', { n: limits?.daily_likes ?? 20 })}</Tiny>
      </Screen>
    );
  }

  const items = data?.items ?? [];
  return (
    <Screen tabs="likes">
      <Title kicker={t('screens.likes.kickerPaid')} heading={tier === 'plus' ? t('screens.likes.headingPlus') : t('screens.likes.headingPremium')} sub={t('screens.likes.subPaid')} />
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
      <Card tight>
        <Between>
          <View><Bold>{tier === 'plus' ? 'RENVI Plus' : 'RENVI Premium'}</Bold><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{tier === 'plus' ? t('screens.likes.plusPerDay', { n: limits?.daily_likes ?? 100 }) : t('screens.likes.premiumPerDay', { n: limits?.daily_likes ?? 300 })}</Text></View>
          <LinkBtn label={t('screens.likes.terms')} onPress={() => router.push('/plans')} />
        </Between>
      </Card>
    </Screen>
  );
}

function IncomingRow({ it }: { it: IncomingSpark }) {
  const { t } = useLang();
  // incoming_sparks returns photo + verified (0030); profile_card per row only for an older database.
  const fromList = it.photo !== undefined;
  const card = useAsync(() => (fromList ? Promise.resolve(null) : api.profileCard(it.profile_id)), [it.profile_id, fromList]);
  const url = useSignedUrl(fromList ? it.photo : card.data?.photos[0]?.path);
  const verified = fromList ? !!it.verified : !!card.data?.verified;
  const what = it.target_kind === 'prompt' ? t('screens.likes.sparkOnPrompt') : it.target_kind === 'photo' ? t('screens.likes.sparkOnPhoto') : t('screens.likes.spark');
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/incoming-profile', params: { id: it.profile_id } })} style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Avatar uri={url} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>{it.name}, {it.age} {verified ? '✓' : ''}</Text>
        <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{it.city} · {what}</Text>
      </View>
      <Text style={{ color: '#aaa' }}>›</Text>
    </Pressable>
  );
}

function plural(n: number, t: TFunction) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return t('screens.likes.pluralOne');
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return t('screens.likes.pluralFew');
  return t('screens.likes.pluralMany');
}
