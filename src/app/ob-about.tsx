import { View } from 'react-native';
import { Between, Btn, Eyebrow, Field, Pill, Screen, Tiny, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { INTERESTS } from '@/lib/catalog';
import { useSession } from '@/lib/session';

// 16 · О себе и интересы
export default function ObAbout() {
  const { profile } = useSession();
  const toast = useToast();
  const [bio, setBio] = useDraft<string>(profile?.bio ?? '');
  const [picked, setPicked] = useDraft<string[]>(profile?.interests ?? []);
  const { save, busy } = useStepSave('ob-about');
  const toggle = (x: string) => {
    if (picked.includes(x)) setPicked(picked.filter((p) => p !== x));
    else if (picked.length >= 5) toast('Можно выбрать до 5 интересов');
    else setPicked([...picked, x]);
  };
  return (
    <Screen>
      <OnbHeader step={6} kicker="НЕ ТОЛЬКО ФОТО" heading="Что важно о вас?" sub="Короткий ответ — уже хороший повод начать разговор." />
      <Field label="О СЕБЕ" value={bio} onChangeText={setBio} multiline maxLength={500} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Например, люблю находить места, где можно задержаться подольше…" />
      <Between><Eyebrow>ИНТЕРЕСЫ · ДО 5</Eyebrow><Tiny>{picked.length} из 5</Tiny></Between>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTERESTS.map((x) => <Pill key={x} label={`${picked.includes(x) ? '✓　' : ''}${x}`} active={picked.includes(x)} onPress={() => toggle(x)} />)}
      </View>
      <Btn label="Продолжить" busy={busy} onPress={() => save({ bio: bio.trim(), interests: picked })} />
      <Btn kind="ghost" label="Позже" onPress={() => save({})} />
    </Screen>
  );
}
