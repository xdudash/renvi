import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, Title } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 49 · Удалённое сообщение
export default function MessageDeleted() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const back = () => router.replace({ pathname: '/chat', params: { match } });
  return (
    <Screen tabs="chats">
      <BackLink onPress={back} />
      <Title kicker={t('screens.messageDeleted.dialog')} heading={t('screens.messageDeleted.soobschenieUdaleno')} sub={t('screens.messageDeleted.drugoyChelovekUviditAkkura')} />
      <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12 }}>
        <Text style={{ fontSize: 10, color: '#7d7971' }}>{t('screens.messageDeleted.vyUdaliliSoobschenie')}</Text>
      </View>
      <Btn label={t('screens.messageDeleted.vernutsyaVDialog')} onPress={back} />
    </Screen>
  );
}
