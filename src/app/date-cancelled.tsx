import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Screen, Title } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 62 · Отменено
export default function DateCancelled() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker={t('screens.dateCancelled.kicker')} heading={t('screens.dateCancelled.heading')} sub={t('screens.dateCancelled.sub')} />
      <Card><Chip label={t('screens.dateCancelled.chip')} /></Card>
      <Btn label={t('screens.dateCancelled.back')} onPress={toChat} />
    </Screen>
  );
}
