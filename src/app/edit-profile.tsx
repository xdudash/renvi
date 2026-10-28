import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Between, Bold, Btn, Card, Choice, Eyebrow, Field, LinkBtn, Screen, Sheet, Tiny, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { useSession } from '@/lib/session';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useMyPrompts } from '@/hooks/usePrompts';
import { api } from '@/lib/api';
import { INTENTS } from '@/lib/catalog';

// 64 · Редактировать анкету
export default function EditProfile() {
  const toast = useToast();
  const { profile, refresh } = useSession();
  const { items } = useMyPhotos();
  const { items: prompts } = useMyPrompts();
  const [name, setName] = useDraft<string>(profile?.display_name ?? '');
  const [bio, setBio] = useDraft<string>(profile?.bio ?? '');
  const [intent, setIntent] = useDraft<string>(profile?.intent ?? 'serious');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const videos = items.filter((i) => i.kind === 'video').length;
  const save = async () => {
    if (!name.trim()) { toast('Введите имя'); return; }
    setBusy(true);
    try { await api.saveOnboarding({ display_name: name.trim(), bio: bio.trim(), intent }); await refresh(); toast('Изменения сохранены'); router.navigate('/me'); }
    catch { toast('Не удалось сохранить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker="МОЯ АНКЕТА" heading="Добавьте немного себя" sub="Всё можно изменить. До публикации вы увидите предпросмотр." />
      <Eyebrow>ИМЯ · ВОЗРАСТ</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <View style={{ flex: 1 }}><Field value={name} onChangeText={setName} accessibilityLabel="Имя" /></View>
        <View style={{ flex: 1 }}><Field value={String(profile?.age ?? '')} editable={false} accessibilityLabel="Возраст" /></View>
      </View>
      <Field label="О СЕБЕ" value={bio} onChangeText={setBio} multiline maxLength={500} style={{ minHeight: 83, textAlignVertical: 'top' }} />
      <Eyebrow>НАМЕРЕНИЕ</Eyebrow>
      <Choice selected onPress={() => setOpen(true)}><Text style={{ fontSize: 12 }}>{INTENTS.find((i) => i.key === intent)?.chip}</Text><Text>⌄</Text></Choice>
      <Card tight><Between><Bold>Фото и видео</Bold><LinkBtn label="Управлять" onPress={() => router.push('/edit-media')} /></Between><Tiny>{items.length} из 6 медиа · {videos} {videos === 1 ? 'короткое видео' : 'коротких видео'}</Tiny></Card>
      <Card tight><Between><Bold>Ответы в анкете</Bold><LinkBtn label="Редактировать" onPress={() => router.push('/edit-prompts')} /></Between><Tiny>{prompts.length} {prompts.length === 1 ? 'ответ' : 'ответа'} · можно добавить до трёх</Tiny></Card>
      <Card tight><Between><Bold>Музыка</Bold><LinkBtn label="Изменить" onPress={() => router.push('/edit-music')} /></Between><Tiny>{profile?.music_title ?? 'Трек не добавлен'}</Tiny></Card>
      <Card tight><Between><Bold>Темы для первого шага</Bold><LinkBtn label="Настроить" onPress={() => router.push('/opening-moves')} /></Between><Tiny>До трёх тем для новых совпадений</Tiny></Card>
      <Btn label="Сохранить изменения" busy={busy} onPress={save} />
      <Btn kind="ghost" label="Предпросмотр профиля" onPress={() => router.push('/profile?self=1')} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        {INTENTS.map((i) => (
          <Choice key={i.key} selected={intent === i.key} onPress={() => { setIntent(i.key); setOpen(false); }}>
            <Text style={{ fontSize: 12 }}>{i.chip}</Text><Text>{intent === i.key ? '✓' : ''}</Text>
          </Choice>
        ))}
      </Sheet>
    </Screen>
  );
}
