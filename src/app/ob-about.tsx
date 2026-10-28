import { View } from 'react-native';
import { Between, Btn, Eyebrow, Field, Pill, Screen, Tiny, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { INTERESTS, interestLabel } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 16 · О себе и интересы
export default function ObAbout() {
  const { t } = useLang();
  const { profile } = useSession();
  const toast = useToast();
  const [bio, setBio] = useDraft<string>(profile?.bio ?? '');
  const [picked, setPicked] = useDraft<string[]>(profile?.interests ?? []);
  const { save, busy } = useStepSave('ob-about');
  const toggle = (x: string) => {
    if (picked.includes(x)) setPicked(picked.filter((p) => p !== x));
    else if (picked.length >= 5) toast(t('screens.obAbout.maxInterests'));
    else setPicked([...picked, x]);
  };
  return (
    <Screen>
      <OnbHeader step={6} kicker={t('screens.obAbout.kicker')} heading={t('screens.obAbout.heading')} sub={t('screens.obAbout.sub')} />
      <Field label={t('screens.obAbout.about')} value={bio} onChangeText={setBio} multiline maxLength={500} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.obAbout.bioPlaceholder')} />
      <Between><Eyebrow>{t('screens.obAbout.interests')}</Eyebrow><Tiny>{t('screens.obAbout.counter', { count: picked.length })}</Tiny></Between>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTERESTS.map((x) => <Pill key={x} label={`${picked.includes(x) ? '✓　' : ''}${interestLabel(t, x)}`} active={picked.includes(x)} onPress={() => toggle(x)} />)}
      </View>
      <Btn label={t('screens.obAbout.continue')} busy={busy} onPress={() => save({ bio: bio.trim(), interests: picked })} />
      <Btn kind="ghost" label={t('screens.obAbout.later')} onPress={() => save({})} />
    </Screen>
  );
}
