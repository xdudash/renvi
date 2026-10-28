import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Choice, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 50 · Действия с сообщением
export default function MessageActions() {
  const { t } = useLang();
  const { match, id, mine, body } = useLocalSearchParams<{ match: string; id: string; mine: string; body?: string }>();
  const toast = useToast();
  const isMine = mine === '1';
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.messageActions.kicker')} heading={t('screens.messageActions.heading')} sub={t('screens.messageActions.sub')} />
      <View style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: isMine ? colors.red : '#EAE6E0', borderRadius: 16, padding: 12, marginTop: 30, marginBottom: 20 }}>
        <Text style={{ color: isMine ? '#fff' : colors.ink, fontSize: 13 }}>{body}</Text>
      </View>
      <Card>
        <Choice onPress={async () => { await Clipboard.setStringAsync(body ?? ''); toast(t('screens.messageActions.copied')); }}><Text style={{ fontSize: 12 }}>{t('screens.messageActions.copy')}</Text><Text>›</Text></Choice>
        {isMine ? (
          <Choice onPress={async () => { try { await api.deleteMessage(id); router.replace({ pathname: '/message-deleted', params: { match } }); } catch { toast(t('screens.messageActions.deleteFailed')); } }}><Text style={{ fontSize: 12 }}>{t('screens.messageActions.deleteMine')}</Text><Text>›</Text></Choice>
        ) : (
          <Choice onPress={() => router.push({ pathname: '/report', params: { message: id, match } })}><Text style={{ fontSize: 12 }}>{t('screens.messageActions.report')}</Text><Text>›</Text></Choice>
        )}
      </Card>
      <Btn kind="ghost" label={t('screens.messageActions.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}
