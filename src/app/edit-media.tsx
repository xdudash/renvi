import { router } from 'expo-router';
import { BackLink, Bold, Btn, Card, Screen, Tiny, Title, useToast } from '@/components/ui';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useLang } from '@/lib/lang';

// 65 · Фото и короткие видео
export default function EditMedia() {
  const { t } = useLang();
  const toast = useToast();
  const { items, add, remove, makeCover, busy } = useMyPhotos();
  const onAdd = async () => {
    const r = await add();
    if (r === 'denied') toast(t('screens.editMedia.photoPermission'));
    if (r === 'error') toast(t('screens.editMedia.uploadFailed'));
    if (r === 'full') toast(t('screens.editMedia.full'));
  };
  const onRemove = async (id: string) => {
    if (items.filter((i) => i.kind === 'photo').length <= 2 && items.find((i) => i.id === id)?.kind === 'photo') { toast(t('screens.editMedia.minPhotos')); return; }
    await remove(id);
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.editMedia.kicker')} heading={t('screens.editMedia.heading')} sub={t('screens.editMedia.sub')} />
      <PhotoGrid items={items} onAdd={onAdd} onRemove={onRemove} onCover={makeCover} busy={busy} />
      <Card><Bold>{t('screens.editMedia.tipsTitle')}</Bold><Tiny>{t('screens.editMedia.tips')}</Tiny></Card>
      <Btn label={t('screens.editMedia.saveOrder')} onPress={() => { toast(t('screens.editMedia.saved')); router.navigate('/me'); }} />
    </Screen>
  );
}
