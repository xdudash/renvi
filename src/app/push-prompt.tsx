import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Row, Screen, Title, useToast } from '@/components/ui';
import { enablePush } from '@/lib/push';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 43 · Уведомления после совпадения
export default function PushPrompt() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match?: string }>();
  const toast = useToast();
  const next = () => (match ? router.replace({ pathname: '/chat', params: { match } }) : router.replace('/chats'));
  const enable = async () => {
    const r = await enablePush();
    toast(r === 'ok' ? t('screens.pushPrompt.on') : r === 'denied' ? t('screens.pushPrompt.denied') : r === 'unsupported' ? t('screens.pushPrompt.unsupported') : t('screens.pushPrompt.failed'));
    next();
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.pushPrompt.kicker')} heading={t('screens.pushPrompt.heading')} sub={t('screens.pushPrompt.sub')} />
      <Card>
        <Row>
          <Text style={{ fontSize: 25, color: colors.red }}>♡</Text>
          <View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.pushPrompt.important')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.pushPrompt.importantNote')}</Text></View>
        </Row>
      </Card>
      <Btn label={t('screens.pushPrompt.enable')} onPress={enable} />
      <Btn kind="ghost" label={t('screens.pushPrompt.notNow')} onPress={next} />
    </Screen>
  );
}
