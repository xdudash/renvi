import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Btn, Card, Eyebrow, LinkBtn, Loading, Screen } from '@/components/ui';
import { DarkCard, StepList } from '@/components/Kit';
import { useAsync } from '@/hooks/useAsync';
import { lookupInvite, rememberInvite } from '@/lib/referral';
import { useLang } from '@/lib/lang';

// 08 · Приглашение по ссылке: who invited, what both get (a week of Plus after the account is checked), what happens next.
export default function Invite() {
  const { t } = useLang();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data, loading, error } = useAsync(() => lookupInvite(code ?? ''), [code]);
  useEffect(() => {
    if (!loading && (error || !data)) router.replace('/invite-not-found');
    if (data && code) rememberInvite(code);
  }, [loading, error, data, code]);
  if (loading || !data) return <Screen><Loading /></Screen>;
  const name = data.name;
  return (
    <Screen>
      <View style={s.hero}>
        <Avatar size={64} />
        <Eyebrow>{t('screens.inviteInviteCode.priglashenieRenvi')}</Eyebrow>
        <Text style={s.h} accessibilityRole="header">{name ? t('invite.h', { name }) : t('invite.hAnon')}</Text>
        <Text style={s.lede}>{t('invite.lede')}</Text>
      </View>
      <DarkCard style={{ padding: 14, alignItems: 'center' }}>
        <Text style={s.rewardH}>{t('invite.reward')}</Text>
        <Text style={s.rewardSub}>{t('invite.rewardSub')}</Text>
      </DarkCard>
      <Card tight>
        <StepList items={[t('invite.step1'), t('invite.step2'), name ? t('invite.step3', { name }) : t('invite.step3Anon')]} />
      </Card>
      <Btn label={t('invite.create')} onPress={() => router.push('/signup')} />
      <Btn kind="secondary" label={t('invite.have')} onPress={() => router.push('/signin')} />
      <LinkBtn center label={t('invite.broken')} onPress={() => router.push('/invite-not-found')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, marginTop: 8 },
  h: { fontSize: 24, fontWeight: '900', letterSpacing: -1, lineHeight: 27, textAlign: 'center', color: '#201E1D' },
  lede: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', color: '#706862' },
  rewardH: { fontSize: 13, fontWeight: '800', color: '#fff' },
  rewardSub: { fontSize: 11, color: '#CFC9C1', marginTop: 3 },
});
