import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Between, Bold, Btn, Card, Chip, LinkBtn, Loading, Screen, Segmented, Tiny, Title } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { api, type IncomingSpark } from '@/lib/api';
import { useSession, useTierLimits } from '@/lib/session';
import { colors } from '@/theme/tokens';

// 35–37 · Входящие · Free / Plus / Premium (one screen; the server decides what the plan may see)
export default function Likes() {
  const { tier } = useSession();
  const { limits } = useTierLimits();
  const [seg, setSeg] = useState('new');
  const { data, loading, error, reload } = useAsync(() => api.incoming(), [tier]);
  const matches = useAsync(() => api.matches(), []);
  const count = data?.count ?? 0;

  if (loading) return <Screen tabs="likes"><Loading /></Screen>;
  if (error) return <Screen tabs="likes"><ErrorRetryState onRetry={reload} /></Screen>;

  if (tier === 'free') {
    return (
      <Screen tabs="likes">
        <Title kicker="ВАШИ ИСКРЫ" heading="Кому вы понравились" sub="Новые симпатии появляются здесь. В Free вы увидите число, а открыть список можно в Plus." />
        <View style={{ backgroundColor: colors.redWash, borderRadius: 16, padding: 13 }}>
          <Between><Bold>{count} {plural(count)}</Bold><Chip label="скрыты в Free" tone="red" /></Between>
          <Tiny>Откройте входящие и решите сами, с кем совпасть.</Tiny>
          <Btn label="Посмотреть входящие" onPress={() => router.push('/plans')} />
        </View>
        {count > 0 ? (
          <Card>
            {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 11, opacity: 0.35 }} accessibilityLabel="Скрытая симпатия">
                <Avatar />
                <View><Bold>Новая симпатия</Bold><Text style={{ fontSize: 10, color: colors.sub }}>Близко · совпадают интересы</Text></View>
              </View>
            ))}
          </Card>
        ) : null}
        <Tiny>Free: {limits?.daily_likes ?? 20} лайков в день · расширенные фильтры и входящие искры — в RENVI Plus.</Tiny>
      </Screen>
    );
  }

  const items = data?.items ?? [];
  return (
    <Screen tabs="likes">
      <Title kicker="ВХОДЯЩИЕ ИСКРЫ" heading={tier === 'plus' ? 'Уже выбрали вас' : 'Новые симпатии рядом'} sub="Просмотрите анкету, ответьте на её фото или пропустите." />
      <Segmented items={[{ key: 'new', label: `Новые · ${count}` }, { key: 'matches', label: 'Совпадения' }]} value={seg} onChange={setSeg} />
      <Card>
        {seg === 'new'
          ? items.length ? items.map((it) => <IncomingRow key={it.profile_id} it={it} />) : <Tiny>Пока новых искр нет.</Tiny>
          : (matches.data ?? []).length ? (matches.data ?? []).map((m) => (
              <Pressable key={m.match_id} accessibilityRole="button" onPress={() => router.push({ pathname: '/chat', params: { match: m.match_id } })} style={{ paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Bold>{m.partner_name}, {m.partner_age}</Bold><Text style={{ color: '#aaa' }}>›</Text>
              </Pressable>
            )) : <Tiny>Совпадений пока нет.</Tiny>}
      </Card>
      <Card tight>
        <Between>
          <View><Bold>{tier === 'plus' ? 'RENVI Plus' : 'RENVI Premium'}</Bold><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{tier === 'plus' ? `${limits?.daily_likes ?? 100} лайков в день` : `${limits?.daily_likes ?? 300} лайков и режим инкогнито`}</Text></View>
          <LinkBtn label="Условия" onPress={() => router.push('/plans')} />
        </Between>
      </Card>
    </Screen>
  );
}

function IncomingRow({ it }: { it: IncomingSpark }) {
  const card = useAsync(() => api.profileCard(it.profile_id), [it.profile_id]);
  const url = useSignedUrl(card.data?.photos[0]?.path);
  const what = it.target_kind === 'prompt' ? 'отправил(а) искру на ответ' : it.target_kind === 'photo' ? 'отправил(а) искру на фото' : 'отправил(а) искру';
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

function plural(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'новая искра';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'новые искры';
  return 'новых искр';
}
