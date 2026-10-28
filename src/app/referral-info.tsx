import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 83 · Условия приглашения
export default function ReferralInfo() {
  const { t } = useLang();
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.referralInfo.priglasheniya')} heading={t('screens.referralInfo.kakRabotaetProgramma')} sub={t('screens.referralInfo.nikakogoDostupaKKontaktam')} />
      <Card>
        <Text style={{ fontSize: 13, lineHeight: 20 }}>{t('screens.referralInfo.n1VyOtpravlyaeteLichnuyu')}</Text>
      </Card>
      <Btn label={t('screens.referralInfo.ponyatno')} onPress={() => router.back()} />
    </Screen>
  );
}
