import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Card, SafeBanner, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 85 · Центр безопасности
export default function Safety() {
  const { t } = useLang();
  const { profile: target, match } = useLocalSearchParams<{ profile?: string; match?: string }>();
  const { session } = useSession();
  const toast = useToast();
  const block = async () => {
    if (!target) { router.push('/blocked'); return; }
    try { await api.block(target); toast(t('screens.safety.profilZablokirovan')); router.replace('/blocked'); } catch { toast(t('screens.safety.neUdalosZablokirovat')); }
  };
  return (
    <Screen tabs={session ? 'discover' : undefined}>
      <BackLink />
      <Title kicker={t('screens.safety.bezopasnost')} heading={t('screens.safety.vyUpravlyaeteGranitsami')} sub={t('screens.safety.neNuzhnoObyasnyatOtkaz')} />
      <SafeBanner>{t('screens.safety.dlyaPervoyVstrechiVybirayt')}</SafeBanner>
      <Card tight>
        <Row label={t('screens.safety.zablokirovatProfil')} sub={t('screens.safety.vyBolsheNeUvidite')} onPress={block} />
        <Row label={t('screens.safety.pozhalovatsyaNaProfilIli')} sub={t('screens.safety.myPokazhemHodRassmotreniya')} onPress={() => router.push({ pathname: '/report', params: { profile: target ?? '' } })} />
        <Row label={t('screens.safety.soobschitONezakonnomKonten')} sub={t('screens.safety.otdelnyyProstoyKanalDlya')} onPress={() => router.push({ pathname: '/report', params: { profile: target ?? '', reason: 'illegal' } })} />
        <Row label={t('screens.safety.otpravitIstoriyuChataPodde')} sub={t('screens.safety.tolkoPosleVashegoProsmotra')} onPress={() => router.push({ pathname: '/support-share', params: { match: match ?? '' } })} />
        <Row label={t('screens.safety.pravilaSoobschestva')} sub={t('screens.safety.prozrachnyePravilaIGranits')} onPress={() => router.push('/community-rules')} />
      </Card>
      <Tiny>{t('screens.safety.podtverzhdenieFotoPomogaet')}</Tiny>
    </Screen>
  );
}
