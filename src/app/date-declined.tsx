import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Screen, Title } from '@/components/ui';
import { resetDateDraft } from '@/lib/dateDraft';
import { useLang } from '@/lib/lang';

// 61 · Другое время / отказ
export default function DateDeclined() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      <Title kicker={t('screens.dateDeclined.kicker')} heading={t('screens.dateDeclined.heading')} sub={t('screens.dateDeclined.sub')} />
      <Card><Chip label={t('screens.dateDeclined.chip')} /><Text style={{ fontSize: 13, marginTop: 6 }}>{t('screens.dateDeclined.notReady')}</Text></Card>
      <Btn label={t('screens.dateDeclined.proposeOther')} onPress={() => { resetDateDraft(match); router.replace({ pathname: '/date-create', params: { match } }); }} />
      <Btn kind="ghost" label={t('screens.dateDeclined.backToChat')} onPress={toChat} />
    </Screen>
  );
}
