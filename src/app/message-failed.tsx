import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, Title, useToast } from '@/components/ui';
import { useChat } from '@/lib/chat';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 48 · Сообщение не отправилось
export default function MessageFailed() {
  const { t } = useLang();
  const { match, client, body } = useLocalSearchParams<{ match: string; client: string; body?: string }>();
  const { session } = useSession();
  const toast = useToast();
  const chat = useChat(match, session?.user.id);
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.messageFailed.kicker')} heading={t('screens.messageFailed.heading')} sub={t('screens.messageFailed.sub')} />
      <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: colors.red, borderRadius: 16, borderBottomRightRadius: 4, padding: 12, marginVertical: 25 }}>
        <Text style={{ color: '#fff', fontSize: 13 }}>{body}</Text>
        <Text style={{ color: '#ffe8e4', fontSize: 10, marginTop: 3 }}>{t('screens.messageFailed.notSent')}</Text>
      </View>
      <Btn label={t('screens.messageFailed.retry')} onPress={async () => { const ok = await chat.retry(client); toast(ok ? t('screens.messageFailed.retried') : t('screens.messageFailed.failedAgain')); if (ok) router.back(); }} />
      <Btn kind="ghost" label={t('screens.messageFailed.delete')} onPress={async () => { await chat.discard(client); router.replace({ pathname: '/message-deleted', params: { match } }); }} />
    </Screen>
  );
}
