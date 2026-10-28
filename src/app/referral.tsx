import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { BackLink, Between, Bold, Btn, Card, Chip, Eyebrow, LinkBtn, Loading, Meter, Screen, Tiny, Title, useToast } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { inviteUrl, myReferral } from '@/lib/referral';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 82 · Пригласить друга
export default function Referral() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => myReferral(), []);
  if (loading) return <Screen tabs="me"><BackLink /><Loading /></Screen>;
  if (error || !data) return <Screen tabs="me"><BackLink /><ErrorRetryState onRetry={reload} /></Screen>;
  const url = inviteUrl(data.code);
  const pretty = url.replace(/^https?:\/\//, '');
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker={t('screens.referral.kicker')} heading={t('screens.referral.heading')} sub={t('screens.referral.sub')} />
      <Card style={{ backgroundColor: colors.blush, borderColor: colors.blush }}>
        <Eyebrow>{t('screens.referral.yourLink')}</Eyebrow>
        <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.8, marginVertical: 8 }} selectable>{pretty}</Text>
        <Between>
          <Tiny>{t('screens.referral.codeNote')}</Tiny>
          <LinkBtn label={t('screens.referral.copy')} onPress={async () => { await Clipboard.setStringAsync(url); toast(t('screens.referral.copied')); }} />
        </Between>
      </Card>
      <Card>
        <Between><Bold>{t('screens.referral.progress')}</Bold><Chip label={t('screens.referral.progressChip', { verified: data.verified, goal: data.goal })} /></Between>
        <View style={{ marginVertical: 10 }}><Meter value={(data.verified / Math.max(1, data.goal)) * 100} /></View>
        <Tiny>{t('screens.referral.progressNote')}</Tiny>
      </Card>
      <Btn label={t('screens.referral.share')} onPress={() => router.push({ pathname: '/share-sheet', params: { url } })} />
      <Btn kind="ghost" label={t('screens.referral.howReward')} onPress={() => router.push('/referral-info')} />
    </Screen>
  );
}
