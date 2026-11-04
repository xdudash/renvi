import { Linking } from 'react-native';
import { Card, Tiny, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { OPERATOR } from '@/lib/operator';
import { useLang } from '@/lib/lang';

/** Who runs the service, with links to the studio site that carries the company and contact details. */
export function OperatorInfo() {
  const { t } = useLang();
  const toast = useToast();
  const open = (url: string) => { Linking.openURL(url).catch(() => toast(t('screens.legal.neUdalosOtkrytDokument'))); };
  return (
    <>
      <Tiny>{`${t('doc.operator.title')}: ${OPERATOR.name}, ${OPERATOR.address}. IČO ${OPERATOR.companyId}, ${OPERATOR.register}.`}</Tiny>
      <Card tight>
        <Row label={t('doc.operator.company')} sub="naoberuky.com/dev" right="↗" onPress={() => open(OPERATOR.companyUrl)} />
        <Row label={t('doc.operator.support')} sub="naoberuky.com/dev/support" right="↗" onPress={() => open(OPERATOR.supportUrl)} />
      </Card>
    </>
  );
}
