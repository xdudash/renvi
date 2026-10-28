import { Linking } from 'react-native';
import { BackLink, Card, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import type { TranslationKey } from '@/i18n';

const DOCS: [string, TranslationKey, TranslationKey][] = [
  ['privacy', 'screens.legal.politikaPrivatnosti', 'screens.legal.kakIspolzuyutsyaDannye'],
  ['terms', 'screens.legal.usloviyaIspolzovaniya', 'screens.legal.pravaIObyazannosti'],
  ['community', 'screens.legal.pravilaSoobschestva', 'screens.legal.uvazhenieIBezopasnost'],
  ['subscriptions', 'screens.legal.podpiskiIVozvraty', 'screens.legal.upravleniePokupkoyApple'],
  ['moderation', 'screens.legal.resheniyaModeratsii', 'screens.legal.statusIApellyatsiya'],
];

// 74 · Правила и документы
export default function Legal() {
  const { t } = useLang();
  const toast = useToast();
  const { data } = useAsync(() => api.config<Record<string, string | null>>('legal_urls'), []);
  const open = (key: string, name: string) => {
    const url = data?.[key];
    if (!url) { toast(t('screens.legal.dokumentNameEscheNe', { name })); return; }
    Linking.openURL(url).catch(() => toast(t('screens.legal.neUdalosOtkrytDokument')));
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.legal.dokumenty')} heading={t('screens.legal.pravilaIProzrachnost')} sub={t('screens.legal.prosmotriteAktualnyeDokume')} />
      <Card tight>{DOCS.map(([k, a, b]) => <Row key={k} label={t(a)} sub={t(b)} right="↗" onPress={() => open(k, t(a))} />)}</Card>
      <Tiny>{t('screens.legal.dokumentyDolzhnyBytProvere')}</Tiny>
    </Screen>
  );
}
