import { Share, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Choice, Screen, Title, useToast } from '@/components/ui';

// 84 · Системный Share Sheet — opens the native share sheet; nothing is sent without the user's choice.
export default function ShareSheet() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const toast = useToast();
  const share = async () => {
    try { await Share.share({ message: `Присоединяйся к RENVI: ${url}`, url }); } catch { toast('Не удалось открыть меню'); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="ПОДЕЛИТЬСЯ" heading="Выберите приложение" sub="Откроется стандартное меню «Поделиться». Ничего не отправляется без вашего выбора." />
      <Card>
        <Choice onPress={share}><Text style={{ fontSize: 12 }}>✉　Сообщения, WhatsApp, AirDrop…</Text><Text>›</Text></Choice>
        <Choice onPress={async () => { await Clipboard.setStringAsync(url ?? ''); toast('Ссылка скопирована'); }}><Text style={{ fontSize: 12 }}>⧉　Скопировать ссылку</Text><Text>›</Text></Choice>
      </Card>
      <Btn kind="ghost" label="Отмена" onPress={() => router.back()} />
    </Screen>
  );
}
