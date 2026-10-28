import { router } from 'expo-router';
import { BackLink, Bold, Btn, Card, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { requestApproxLocation } from '@/lib/location';
import { useSession } from '@/lib/session';
import { useDiscover } from '@/lib/discover';
import { MapMini } from '@/components/MapMini';

// 31 · Местоположение
export default function LocationPermission() {
  const toast = useToast();
  const { profile } = useSession();
  const d = useDiscover();
  const allow = async () => {
    const loc = await requestApproxLocation().catch(() => null);
    if (!loc) { toast('Доступ не дан — оставим только город'); return; }
    try { await api.saveOnboarding({ lat: loc.lat, lng: loc.lng }); await d.load(); toast('Расстояние обновлено'); router.back(); }
    catch { toast('Не удалось сохранить'); }
  };
  const cityOnly = async () => {
    try { await api.saveOnboarding({ location_enabled: false }); toast('Геолокация отключена'); } catch {}
    router.back();
  };
  return (
    <Screen tabs="discover">
      <BackLink />
      <Title kicker="ГЕОЛОКАЦИЯ" heading="Показать людей рядом?" sub="Разрешение не обязательно. Можно оставить только выбранный город." />
      <MapMini label={(profile?.city ?? '').toUpperCase()} />
      <Card><Bold>Ваш точный адрес не показывается</Bold><Tiny>Для расчёта расстояния координаты округляются примерно до километра. В любой момент можно отключить.</Tiny></Card>
      <Btn label="Разрешить только при использовании" onPress={allow} />
      <Btn kind="ghost" label="Оставить город без геолокации" onPress={cityOnly} />
    </Screen>
  );
}
