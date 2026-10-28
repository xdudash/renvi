import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 89 · Правила сообщества
export default function CommunityRules() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.communityRules.kicker')} heading={t('screens.communityRules.heading')} sub={t('screens.communityRules.sub')} />
      <Card>
        <Text style={{ fontSize: 13, lineHeight: 20 }}>{t('screens.communityRules.body')}</Text>
      </Card>
      <Btn label={t('screens.communityRules.ok')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
