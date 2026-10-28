import { router } from 'expo-router';
import { BackLink, Bold, Btn, Card, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { requestApproxLocation } from '@/lib/location';
import { useSession } from '@/lib/session';
import { useDiscover } from '@/lib/discover';
import { MapMini } from '@/components/MapMini';
import { useLang } from '@/lib/lang';

// 31 · Местоположение
export default function LocationPermission() {
  const { t } = useLang();
  const toast = useToast();
  const { profile } = useSession();
  const d = useDiscover();
  const allow = async () => {
    const loc = await requestApproxLocation().catch(() => null);
    if (!loc) { toast(t('screens.locationPermission.denied')); return; }
    try { await api.saveOnboarding({ lat: loc.lat, lng: loc.lng }); await d.load(); toast(t('screens.locationPermission.updated')); router.back(); }
    catch { toast(t('screens.locationPermission.saveFailed')); }
  };
  const cityOnly = async () => {
    try { await api.saveOnboarding({ location_enabled: false }); toast(t('screens.locationPermission.disabled')); } catch {}
    router.back();
  };
  return (
    <Screen tabs="discover">
      <BackLink />
      <Title kicker={t('screens.locationPermission.kicker')} heading={t('screens.locationPermission.heading')} sub={t('screens.locationPermission.sub')} />
      <MapMini label={(profile?.city ?? '').toUpperCase()} />
      <Card><Bold>{t('screens.locationPermission.noExact')}</Bold><Tiny>{t('screens.locationPermission.noExactNote')}</Tiny></Card>
      <Btn label={t('screens.locationPermission.allow')} onPress={allow} />
      <Btn kind="ghost" label={t('screens.locationPermission.cityOnly')} onPress={cityOnly} />
    </Screen>
  );
}
