import { router } from 'expo-router';
import { Btn, SafeBanner, Screen, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useLang } from '@/lib/lang';

// 15 · Фото · минимум 2
export default function ObPhotos() {
  const { t } = useLang();
  const toast = useToast();
  const { items, add, remove, busy } = useMyPhotos();
  const { save, busy: saving } = useStepSave('ob-photos');
  const onAdd = async () => {
    const r = await add();
    if (r === 'denied') toast(t('screens.obPhotos.razreshiteDostupKFoto'));
    if (r === 'error') toast(t('screens.obPhotos.neUdalosZagruzitVideo'));
    if (r === 'full') toast(t('screens.obPhotos.mozhnoDobavitDo6'));
  };
  return (
    <Screen>
      <OnbHeader step={5} kicker={t('screens.obPhotos.pervyyVzglyad')} heading={t('screens.obPhotos.dobavteFotografii')} sub={t('screens.obPhotos.nuzhnoMinimum2Foto')} />
      <PhotoGrid items={items} onAdd={onAdd} onRemove={(id) => remove(id)} busy={busy} />
      <SafeBanner>{t('screens.obPhotos.vyVybiraeteSamiFoto')}</SafeBanner>
      <Btn label={t('screens.obPhotos.prodolzhit')} busy={saving} onPress={() => (items.filter((i) => i.kind === 'photo').length >= 2 ? save({}) : toast(t('screens.obPhotos.dobavteMinimum2Foto')))} />
      <Btn kind="ghost" label={t('screens.obPhotos.pochemuMinimumDvaFoto')} onPress={() => router.push('/community-rules')} />
    </Screen>
  );
}
