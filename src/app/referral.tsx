import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { BackLink, Between, Bold, Btn, Card, Chip, Eyebrow, LinkBtn, Loading, Meter, Screen, Tiny, Title, useToast } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { inviteUrl, myReferral } from '@/lib/referral';
import { colors } from '@/theme/tokens';

// 82 · Пригласить друга
export default function Referral() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => myReferral(), []);
  if (loading) return <Screen tabs="me"><BackLink /><Loading /></Screen>;
  if (error || !data) return <Screen tabs="me"><BackLink /><ErrorRetryState onRetry={reload} /></Screen>;
  const url = inviteUrl(data.code);
  const pretty = url.replace(/^https?:\/\//, '');
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker="ПРИГЛАСИТЕ ДРУГА" heading={'Знакомиться\nлучше вместе.'} sub="Поделитесь личной ссылкой. Награда днями Plus зависит от подтверждённых приглашений." />
      <Card style={{ backgroundColor: colors.blush, borderColor: colors.blush }}>
        <Eyebrow>ВАША ССЫЛКА</Eyebrow>
        <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.8, marginVertical: 8 }} selectable>{pretty}</Text>
        <Between>
          <Tiny>Персональный код · копировать или поделиться</Tiny>
          <LinkBtn label="Копировать" onPress={async () => { await Clipboard.setStringAsync(url); toast('Ссылка скопирована'); }} />
        </Between>
      </Card>
      <Card>
        <Between><Bold>Прогресс приглашений</Bold><Chip label={`${data.verified} из ${data.goal}`} /></Between>
        <View style={{ marginVertical: 10 }}><Meter value={(data.verified / Math.max(1, data.goal)) * 100} /></View>
        <Tiny>После регистрации и проверки приглашённого обновится статус и начисление дней RENVI Plus.</Tiny>
      </Card>
      <Btn label="Поделиться приглашением" onPress={() => router.push({ pathname: '/share-sheet', params: { url } })} />
      <Btn kind="ghost" label="Как начисляется награда?" onPress={() => router.push('/referral-info')} />
    </Screen>
  );
}
