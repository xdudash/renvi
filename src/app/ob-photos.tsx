import { router } from 'expo-router';
import { Btn, SafeBanner, Screen, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useMyPhotos } from '@/hooks/usePhotos';

// 15 · Фото · минимум 2
export default function ObPhotos() {
  const toast = useToast();
  const { items, add, remove, busy } = useMyPhotos();
  const { save, busy: saving } = useStepSave('ob-photos');
  const onAdd = async () => {
    const r = await add();
    if (r === 'denied') toast('Разрешите доступ к фото в настройках');
    if (r === 'error') toast('Не удалось загрузить. Видео — до 15 секунд и 30 МБ.');
    if (r === 'full') toast('Можно добавить до 6 медиа');
  };
  return (
    <Screen>
      <OnbHeader step={5} kicker="ПЕРВЫЙ ВЗГЛЯД" heading="Добавьте фотографии" sub="Нужно минимум 2 фото. Можно добавить до 6; короткие видео — до 15 секунд." />
      <PhotoGrid items={items} onAdd={onAdd} onRemove={(id) => remove(id)} busy={busy} />
      <SafeBanner>Вы выбираете сами. Фото не публикуются до завершения анкеты. Первое фото — обложка.</SafeBanner>
      <Btn label="Продолжить" busy={saving} onPress={() => (items.filter((i) => i.kind === 'photo').length >= 2 ? save({}) : toast('Добавьте минимум 2 фото'))} />
      <Btn kind="ghost" label="Почему минимум два фото?" onPress={() => router.push('/community-rules')} />
    </Screen>
  );
}
