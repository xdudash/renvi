import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Between, Bold, Btn, Card, Choice, Eyebrow, Field, LinkBtn, Screen, Sheet, Tiny, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { useSession } from '@/lib/session';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useMyPrompts } from '@/hooks/usePrompts';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { api } from '@/lib/api';
import { INTENTS } from '@/lib/catalog';
import { useLang } from '@/lib/lang';
import { filledCount } from '@/lib/details';

// 64 · Редактировать анкету
export default function EditProfile() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const { items, reload: reloadPhotos } = useMyPhotos();
  const { items: prompts, reload: reloadPrompts } = useMyPrompts();
  useReloadOnFocus(() => { reloadPhotos(); reloadPrompts(); }); // summaries after edit-media / edit-prompts
  const [name, setName] = useDraft<string>(profile?.display_name ?? '');
  const [bio, setBio] = useDraft<string>(profile?.bio ?? '');
  const [intent, setIntent] = useDraft<string>(profile?.intent ?? 'serious');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const videos = items.filter((i) => i.kind === 'video').length;
  const save = async () => {
    if (!name.trim()) { toast(t('screens.editProfile.enterName')); return; }
    setBusy(true);
    try { await api.saveOnboarding({ display_name: name.trim(), bio: bio.trim(), intent }); await refresh(); toast(t('screens.editProfile.saved')); router.navigate('/me'); }
    catch { toast(t('screens.editProfile.saveFailed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker={t('screens.editProfile.kicker')} heading={t('screens.editProfile.heading')} sub={t('screens.editProfile.sub')} />
      <Eyebrow>{t('screens.editProfile.nameAge')}</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <View style={{ flex: 1 }}><Field value={name} onChangeText={setName} accessibilityLabel={t('screens.editProfile.name')} /></View>
        <View style={{ flex: 1 }}><Field value={String(profile?.age ?? '')} editable={false} accessibilityLabel={t('screens.editProfile.age')} /></View>
      </View>
      <Field label={t('screens.editProfile.about')} value={bio} onChangeText={setBio} multiline maxLength={500} style={{ minHeight: 83, textAlignVertical: 'top' }} />
      <Eyebrow>{t('screens.editProfile.intent')}</Eyebrow>
      <Choice selected onPress={() => setOpen(true)}><Text style={{ fontSize: 12 }}>{(() => { const cur = INTENTS.find((i) => i.key === intent); return cur ? t(cur.chipKey) : null; })()}</Text><Text>⌄</Text></Choice>
      <Card tight><Between><Bold>{t('screens.editProfile.photosVideos')}</Bold><LinkBtn label={t('screens.editProfile.manage')} onPress={() => router.push('/edit-media')} /></Between><Tiny>{t('screens.editProfile.mediaSummary', { count: items.length, videos, videoWord: videos === 1 ? t('screens.editProfile.videoOne') : t('screens.editProfile.videoMany') })}</Tiny></Card>
      <Card tight><Between><Bold>{t('details.section')}</Bold><LinkBtn label={t('screens.editProfile.edit')} onPress={() => router.push('/edit-details')} /></Between><Tiny>{t('details.editSummary', { count: filledCount(profile) })}</Tiny></Card>
      <Card tight><Between><Bold>{t('screens.editProfile.answers')}</Bold><LinkBtn label={t('screens.editProfile.edit')} onPress={() => router.push('/edit-prompts')} /></Between><Tiny>{t('screens.editProfile.answersSummary', { count: prompts.length, word: prompts.length === 1 ? t('screens.editProfile.answerOne') : t('screens.editProfile.answerMany') })}</Tiny></Card>
      <Card tight><Between><Bold>{t('screens.editProfile.music')}</Bold><LinkBtn label={t('screens.editProfile.change')} onPress={() => router.push('/edit-music')} /></Between><Tiny>{profile?.music_title ?? t('screens.editProfile.noTrack')}</Tiny></Card>
      <Card tight><Between><Bold>{t('screens.editProfile.openingMoves')}</Bold><LinkBtn label={t('screens.editProfile.configure')} onPress={() => router.push('/opening-moves')} /></Between><Tiny>{t('screens.editProfile.openingMovesNote')}</Tiny></Card>
      <Btn label={t('screens.editProfile.saveChanges')} busy={busy} onPress={save} />
      <Btn kind="ghost" label={t('screens.editProfile.preview')} onPress={() => router.push('/profile?self=1')} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        {INTENTS.map((i) => (
          <Choice key={i.key} selected={intent === i.key} onPress={() => { setIntent(i.key); setOpen(false); }}>
            <Text style={{ fontSize: 12 }}>{t(i.chipKey)}</Text><Text>{intent === i.key ? '✓' : ''}</Text>
          </Choice>
        ))}
      </Sheet>
    </Screen>
  );
}
