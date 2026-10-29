import { useState } from 'react';
import { Text } from 'react-native';
import { Btn, Choice, Screen, Tiny, Sheet } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { GENDERS } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

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
      <OnbHeader step={1} kicker={t('screens.obGender.kicker')} heading={t('screens.obGender.heading')} sub={t('screens.obGender.sub')} />
      {GENDERS.map((g) => (
        <Choice key={g.key} disabled={locked} selected={selected === g.key} onPress={() => {if(!locked) setV(g.key);}}>
          <Text style={{ fontSize: 12 }}>{t(g.labelKey)}</Text><Text>{selected === g.key ? '✓' : '○'}</Text>
        </Choice>
      ))}
      <Tiny>{t(locked?'identity.genderLocked':'identity.locked')}</Tiny>
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
