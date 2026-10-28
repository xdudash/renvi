import { router } from 'expo-router';
import { BackLink, Bold, Btn, Card, Screen, Tiny, Title, useToast } from '@/components/ui';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useMyPhotos } from '@/hooks/usePhotos';

// 65 · Фото и короткие видео
export default function EditMedia() {
  const toast = useToast();
  const { items, add, remove, makeCover, busy } = useMyPhotos();
  const onAdd = async () => {
    const r = await add();
    if (r === 'denied') toast('Разрешите доступ к фото в настройках');
    if (r === 'error') toast('Не удалось загрузить. Видео — до 15 секунд и 30 МБ.');
    if (r === 'full') toast('Можно добавить до 6 медиа');
  };
  const onRemove = async (id: string) => {
    if (items.filter((i) => i.kind === 'photo').length <= 2 && items.find((i) => i.id === id)?.kind === 'photo') { toast('В анкете должно остаться минимум 2 фото'); return; }
    await remove(id);
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="МЕДИА" heading="Покажите разные стороны" sub="До 6 медиа. Видео — максимум 15 секунд и 30 МБ. Первое фото — обложка." />
      <PhotoGrid items={items} onAdd={onAdd} onRemove={onRemove} onCover={makeCover} busy={busy} />
      <Card><Bold>Советы по фото</Bold><Tiny>Начните с одиночного портрета при хорошем свете. Не добавляйте контакты или адрес.</Tiny></Card>
      <Btn label="Сохранить порядок" onPress={() => { toast('Изменения сохранены'); router.navigate('/me'); }} />
    </Screen>
  );
}
