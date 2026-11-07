import { useState } from 'react';
import { Text } from 'react-native';
import { Btn, Screen, Sheet } from '@/components/ui';
import { BigOption, Hint } from '@/components/Kit';
import type { IconName } from '@/components/UiIcon';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { GENDERS } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

const ICON: Record<string, IconName> = { man: 'profile', woman: 'profile', nonbinary: 'people', undisclosed: 'lock' };

// 11 · Гендер
export default function ObGender() {
  const { t } = useLang();
  const { profile } = useSession();
  const [v, setV] = useDraft<string>(profile?.gender ?? 'man');
  const [confirming,setConfirming]=useState(false);
  const locked=!!profile?.gender_locked_at;
  const selected = locked ? (profile?.gender ?? v) : v;
  const { save, busy } = useStepSave('ob-gender');
  return (
    <Screen>
      <OnbHeader step={3} kicker={t('onbx.gender.kicker')} heading={t('onbx.gender.h')} sub={t('onbx.gender.sub')} />
      {GENDERS.map((g) => (
        <BigOption key={g.key} disabled={locked} on={selected === g.key} icon={ICON[g.key]}
          title={g.key === 'undisclosed' ? t('onbx.gender.undisclosed') : t(g.labelKey)}
          sub={g.key === 'undisclosed' ? t('onbx.gender.undisclosedSub') : undefined}
          onPress={() => { if (!locked) setV(g.key); }} />
      ))}
      <Hint icon="lock">{locked ? t('identity.genderLocked') : t('onbx.gender.hint')}</Hint>
      <Btn label={t('screens.obGender.continue')} onPress={() => locked?save({}):setConfirming(true)} busy={busy} />
      <Sheet visible={confirming} onClose={()=>setConfirming(false)}>
        <Text accessibilityRole="header" style={{fontSize:22}}>{t('identity.confirmGender')}</Text>
        <Text style={{fontSize:22,marginVertical:12}}>{t(GENDERS.find(g=>g.key===v)!.labelKey)}</Text>
        <Text>{t('identity.locked')}</Text>
        <Btn label={t('identity.confirmChoice')} onPress={()=>{setConfirming(false);save({gender:v});}} busy={busy}/>
        <Btn kind="ghost" label={t('identity.cancel')} onPress={()=>setConfirming(false)}/>
      </Sheet>
    </Screen>
  );
}
