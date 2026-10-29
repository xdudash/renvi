import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Card, IconButton, LinkBtn, Meter, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useMyPrompts } from '@/hooks/usePrompts';
import { useAsync } from '@/hooks/useAsync';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { completeness } from '@/lib/completeness';
import { colors } from '@/theme/tokens';
import { Row } from '@/components/Row';
import type { TranslationKey } from '@/i18n';
import { useLang } from '@/lib/lang';

const ROWS = [
  ['screens.me.rowLang', 'screens.me.rowLangSub', '/settings'],
  ['screens.me.rowPrivacy', 'screens.me.rowPrivacySub', '/privacy-data'],
  ['screens.me.rowReferral', 'screens.me.rowReferralSub', '/referral'],
  ['screens.me.rowSafety', 'screens.me.rowSafetySub', '/safety'],
  ['screens.me.rowSupport', 'screens.me.rowSupportSub', '/support-help'],
  ['screens.me.rowLegal', 'screens.me.rowLegalSub', '/legal'],
] as const;
const VERIFY: Record<string, readonly [TranslationKey, string]> = {
  pending: ['screens.me.verifyPending', '/verification-pending'],
  approved: ['screens.me.verifyApproved', '/verification-approved'],
  rejected: ['screens.me.verifyRejected', '/verification-rejected'],
  none: ['screens.me.verifyNone', '/ob-verify'],
};

// 63 · Мой профиль
export default function Me() {
  const { t } = useLang();
  const { profile } = useSession();
  const { items, reload: reloadPhotos } = useMyPhotos();
  const { items: prompts, reload: reloadPrompts } = useMyPrompts();
  const incoming = useAsync(() => api.incoming(), []);
  // Back from edit-media / edit-prompts / likes: avatar, completeness and counters must be current.
  useReloadOnFocus(() => { reloadPhotos(); reloadPrompts(); incoming.reload(); });
  const pct = completeness(profile, items.length, prompts.length);
  const v = VERIFY[profile?.verification_status ?? 'none'];
  return (
    <Screen tabs="me">
      <Title kicker={t('screens.me.kicker')} heading={t('screens.me.heading')} sub={t('screens.me.sub')} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Avatar uri={items[0]?.url} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{profile?.display_name ?? ''}{profile?.age ? `, ${profile.age}` : ''}</Text>
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.me.profileFilled', { city: profile?.city ?? '', pct })}</Text>
          </View>
          <IconButton label={t('screens.me.editProfile')} text="✎" onPress={() => router.push('/edit-profile')} />
        </View>
        <View style={{ marginTop: 12 }}><Meter value={pct} /></View>
        <LinkBtn label={t('screens.me.improve')} onPress={() => router.push('/edit-profile')} />
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/likes')} style={tile}>
          <Text style={eyebrow}>{t('screens.me.newSparks')}</Text><Text style={metric}>{incoming.data?.count ?? 0}</Text><Text style={tiny}>{t('screens.me.view')}</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -1, marginTop: 23, marginBottom: 8, color: colors.ink }}>{t('screens.me.settingsHelp')}</Text>
      <Card tight>
        {ROWS.map(([a, b, c]) => <Row key={c} label={t(a)} sub={t(b)} onPress={() => router.push(c as never)} />)}
        <Row label={t(v[0])} sub={t('screens.me.selfieCheck')} onPress={() => router.push(v[1] as never)} />
      </Card>
    </Screen>
  );
}

const tile = { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 17, padding: 12 } as const;
const eyebrow = { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.eyebrow } as const;
const metric = { fontSize: 31, fontWeight: '800', letterSpacing: -1.5, color: colors.ink, marginVertical: 4 } as const;
const tiny = { fontSize: 10, color: colors.muted } as const;
