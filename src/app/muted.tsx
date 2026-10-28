import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Between, Btn, Card, Chip, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 52 · Отключённые уведомления
export default function Muted() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.muted.uvedomleniya')} heading={t('screens.muted.dialogBezUvedomleniy')} sub={t('screens.muted.vazhnyeSoobscheniyaOstanut')} />
      <Card>
        <Between>
          <View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.muted.uvedomleniyaVyklyucheny')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.muted.vyNePoteryaetePerepisku')}</Text></View>
          <Chip label={t('screens.muted.pauza')} tone="amber" />
        </Between>
      </Card>
      <Btn label={t('screens.muted.vklyuchitUvedomleniya')} onPress={async () => { try { await api.matchSettings(match, { muted: false }); toast(t('screens.muted.uvedomleniyaVklyucheny')); router.replace({ pathname: '/chat', params: { match } }); } catch { toast(t('screens.muted.neUdalosIzmenit')); } }} />
    </Screen>
  );
}
