import { AnalyticsConsent } from '@/components/AnalyticsConsent';
import { router } from 'expo-router';
import { BackLink, Card, Eyebrow, Screen, Tiny, Title } from '@/components/ui';
import { Row } from '@/components/Row';
import { useLang } from '@/lib/lang';

// 71 · Приватность и данные
export default function PrivacyData() {
  const { t } = useLang();
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker={t('screens.privacyData.privatnost')} heading={t('screens.privacyData.dannyePodVashimKontrolem')} sub={t('screens.privacyData.pokazyvaemPonyatnyeNastroy')} />
      <Card tight>
        <Eyebrow>{t('screens.privacyData.vashiVybory')}</Eyebrow>
        <Row label={t('screens.privacyData.vidimostAnkety')} sub={t('screens.privacyData.pauzaAktivnostInkognito')} onPress={() => router.push('/privacy-visibility')} />
        <Row label={t('screens.privacyData.geolokatsiya')} sub={t('screens.privacyData.gorodPrimernoeRasstoyanie')} onPress={() => router.push('/location-permission')} />
        <Row label={t('screens.privacyData.zablokirovannyeProfili')} onPress={() => router.push('/blocked')} />
      </Card>
      <Card tight>
        <Eyebrow>{t('screens.privacyData.vashiDannye')}</Eyebrow>
        <Row label={t('screens.privacyData.poluchitKopiyuDannyh')} sub={t('screens.privacyData.zaprositFaylVPerenosimom')} onPress={() => router.push('/data-export')} />
        <Row label={t('screens.privacyData.udalitAkkaunt')} sub={t('screens.privacyData.udalenieBezPovtornogoPredl')} onPress={() => router.push('/delete-account')} />
        <Row label={t('screens.privacyData.soglasiyaIDokumenty')} onPress={() => router.push('/legal')} />
      </Card>
      <AnalyticsConsent />
      <Tiny>{t('screens.privacyData.sobiraemTolkoDannyeNeobhod')}</Tiny>
    </Screen>
  );
}
