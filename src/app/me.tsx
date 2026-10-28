import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Card, IconButton, LinkBtn, Meter, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useMyPrompts } from '@/hooks/usePrompts';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { completeness } from '@/lib/completeness';
import { colors } from '@/theme/tokens';
import { Row } from '@/components/Row';

const ROWS: [string, string, string][] = [
  ['Язык и доступность', 'SK · CS · EN · RU · UA', '/settings'],
  ['Приватность и данные', 'Управление информацией', '/privacy-data'],
  ['Подписка и покупки', 'Условия · восстановление', '/plans'],
  ['Пригласить друзей', 'Дни Plus за приглашение', '/referral'],
  ['Центр безопасности', 'Жалоба · блокировка · советы', '/safety'],
  ['Правила и документы', 'Условия · политика · правила', '/legal'],
];
const VERIFY: Record<string, [string, string]> = {
  pending: ['Проверка фото ожидает модератора', '/verification-pending'],
  approved: ['Фото подтверждено', '/verification-approved'],
  rejected: ['Нужно другое селфи', '/verification-rejected'],
  none: ['Пройти селфи-проверку', '/ob-verify'],
};

// 63 · Мой профиль
export default function Me() {
  const { profile, tier } = useSession();
  const { items } = useMyPhotos();
  const { items: prompts } = useMyPrompts();
  const incoming = useAsync(() => api.incoming(), [tier]);
  const pct = completeness(profile, items.length, prompts.length);
  const v = VERIFY[profile?.verification_status ?? 'none'];
  return (
    <Screen tabs="me">
      <Title kicker="ВАШЕ ПРОСТРАНСТВО" heading={'Немного больше\nвас.'} sub="Настройте видимость, язык и то, как начинается разговор." />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Avatar uri={items[0]?.url} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{profile?.display_name ?? ''}{profile?.age ? `, ${profile.age}` : ''}</Text>
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{profile?.city ?? ''} · профиль заполнен на {pct}%</Text>
          </View>
          <IconButton label="Редактировать анкету" text="✎" onPress={() => router.push('/edit-profile')} />
        </View>
        <View style={{ marginTop: 12 }}><Meter value={pct} /></View>
        <LinkBtn label="Улучшить профиль　›" onPress={() => router.push('/edit-profile')} />
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/likes')} style={tile}>
          <Text style={eyebrow}>НОВЫЕ ИСКРЫ</Text><Text style={metric}>{incoming.data?.count ?? 0}</Text><Text style={tiny}>посмотреть</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/plans')} style={tile}>
          <Text style={eyebrow}>ВАШ ПЛАН</Text><Text style={metric}>{tier === 'free' ? 'Free' : tier === 'plus' ? 'Plus' : 'Premium'}</Text><Text style={tiny}>условия и управление</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -1, marginTop: 23, marginBottom: 8, color: colors.ink }}>Настройки и помощь</Text>
      <Card tight>
        {ROWS.map(([a, b, c]) => <Row key={c} label={a} sub={b} onPress={() => router.push(c as never)} />)}
        <Row label={v[0]} sub="Селфи-проверка" onPress={() => router.push(v[1] as never)} />
      </Card>
    </Screen>
  );
}

const tile = { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 17, padding: 12 } as const;
const eyebrow = { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.eyebrow } as const;
const metric = { fontSize: 31, fontWeight: '800', letterSpacing: -1.5, color: colors.ink, marginVertical: 4 } as const;
const tiny = { fontSize: 10, color: colors.muted } as const;
