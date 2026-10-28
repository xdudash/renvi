import { Share, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Choice, Screen, Title, useToast } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 84 · Системный Share Sheet — opens the native share sheet; nothing is sent without the user's choice.
export default function ShareSheet() {
  const { t } = useLang();
  const { url } = useLocalSearchParams<{ url: string }>();
  const toast = useToast();
  const share = async () => {
    try { await Share.share({ message: t('screens.shareSheet.prisoedinyaysyaKRenviUrl', { url }), url }); } catch { toast(t('screens.shareSheet.neUdalosOtkrytMenyu')); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.shareSheet.podelitsya')} heading={t('screens.shareSheet.vyberitePrilozhenie')} sub={t('screens.shareSheet.otkroetsyaStandartnoeMenyu')} />
      <Card>
        <Choice onPress={share}><Text style={{ fontSize: 12 }}>{t('screens.shareSheet.soobscheniyaWhatsappAirdro')}</Text><Text>›</Text></Choice>
        <Choice onPress={async () => { await Clipboard.setStringAsync(url ?? ''); toast(t('screens.shareSheet.ssylkaSkopirovana')); }}><Text style={{ fontSize: 12 }}>{t('screens.shareSheet.skopirovatSsylku')}</Text><Text>›</Text></Choice>
      </Card>
      <Btn kind="ghost" label={t('screens.shareSheet.otmena')} onPress={() => router.back()} />
    </Screen>
  );
}
