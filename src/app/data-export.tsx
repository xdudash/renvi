import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { BackLink, Btn, Card, Row, Screen, Tiny, Title, useToast } from '@/components/ui';
import { requestDataExport } from '@/lib/account';
import { colors } from '@/theme/tokens';

// 75 · Выгрузить данные
export default function DataExport() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const request = async () => {
    setBusy(true);
    try {
      const r = await requestDataExport();
      if (r.emailed) toast('Ссылка отправлена на подтверждённую почту');
      else if (r.url) { setUrl(r.url); toast('Файл готов'); }
    } catch { toast('Не удалось подготовить файл'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="КОПИЯ ДАННЫХ" heading="Получите свои данные" sub="Файл будет содержать информацию профиля, настройки, совпадения и переписки в пределах действующих правил хранения." />
      <Card>
        <Row>
          <Text style={{ fontSize: 23, color: colors.red }}>↓</Text>
          <View><Text style={{ fontWeight: '700', fontSize: 13 }}>Формат JSON</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Ссылка придёт на подтверждённую почту</Text></View>
        </Row>
      </Card>
      <Btn label="Запросить выгрузку" busy={busy} onPress={request} />
      {url ? <Btn kind="secondary" label="Скачать файл (ссылка 24 часа)" onPress={() => Linking.openURL(url)} /> : null}
      <Tiny>Запрос выполняется только для вошедшего владельца аккаунта. Ссылка действует 24 часа.</Tiny>
    </Screen>
  );
}
