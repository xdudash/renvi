import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { BackLink, Btn, Card, Row, Screen, Tiny, Title, useToast } from '@/components/ui';
import { requestDataExport } from '@/lib/account';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 75 · Выгрузить данные
export default function DataExport() {
  const { t } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const request = async () => {
    setBusy(true);
    try {
      const r = await requestDataExport();
      if (r.emailed) toast(t('screens.dataExport.emailed'));
      else if (r.url) { setUrl(r.url); toast(t('screens.dataExport.ready')); }
    } catch { toast(t('screens.dataExport.failed')); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.dataExport.kicker')} heading={t('screens.dataExport.heading')} sub={t('screens.dataExport.sub')} />
      <Card>
        <Row>
          <Text style={{ fontSize: 23, color: colors.red }}>↓</Text>
          <View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.dataExport.format')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.dataExport.linkByEmail')}</Text></View>
        </Row>
      </Card>
      <Btn label={t('screens.dataExport.request')} busy={busy} onPress={request} />
      {url ? <Btn kind="secondary" label={t('screens.dataExport.download')} onPress={() => Linking.openURL(url)} /> : null}
      <Tiny>{t('screens.dataExport.note')}</Tiny>
    </Screen>
  );
}
