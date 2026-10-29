import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, CheckRow, Field, LinkBtn, SafeBanner, Screen, Sheet, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { useSession } from '@/lib/session';
import { BirthdayPicker } from '@/components/BirthdayPicker';
import { ageOnDate } from '@/lib/identity';
import { useLang } from '@/lib/lang';


// 10 · Возраст и имя
export default function ObAge() {
  const { t } = useLang();
  const { profile } = useSession();
  const toast = useToast();
  const [name, setName] = useDraft<string>(profile?.display_name ?? '');
  const [birthdate, setBirthdate] = useState<string>(profile?.birthdate ?? '');
  const birthdateLocked=!!profile?.birthdate_locked_at;
  const [adult, setAdult] = useDraft(Boolean(profile?.adult_confirmed_at));
  const [terms, setTerms] = useDraft(Boolean(profile?.terms_accepted_at));
  const { save, busy, saveDraftAndExit } = useStepSave('ob-age');
  const [confirming,setConfirming]=useState(false);
  const persist=()=>{setConfirming(false);save({display_name:name.trim(),...(!birthdateLocked?{birthdate}:{}),adult_confirmed:true,terms_accepted:true});};
  const next = () => {
    if (!adult || !terms) { toast(t('screens.obAge.podtverditeVozrastIUsloviy')); return; }
    if (name.trim().length < 1) { toast(t('screens.obAge.vvediteImya')); return; }
    const age=ageOnDate(birthdate);
    if (!birthdateLocked && (age===null || age<18 || age>120)) { toast(t('identity.invalidBirthday')); return; }
    if(!birthdateLocked) setConfirming(true); else persist();
  };
  return (
    <Screen>
      <OnbHeader step={0} kicker={t('screens.obAge.pervyyShag')} heading={t('screens.obAge.skolkoVamLet')} sub={t('screens.obAge.uchastnikamRenviDolzhnoByt')} />
      <Field label={t('screens.obAge.imya')} value={name} onChangeText={setName} placeholder={t('screens.obAge.kakVasNazyvat')} autoComplete="given-name" />
      <Text style={{fontSize:11,marginTop:16}}>{t('screens.obAge.dataRozhdeniya')}</Text>
      <BirthdayPicker value={birthdateLocked ? (profile?.birthdate ?? birthdate) : birthdate} onChange={setBirthdate} disabled={birthdateLocked}/>
      <Text style={{fontSize:12,color:'#706862'}}>{t(birthdateLocked?'identity.birthdayLocked':'identity.locked')}</Text>
      <CheckRow left on={adult} onPress={() => setAdult(!adult)}><Text style={{ fontSize: 12 }}>{t('screens.obAge.mneUzheIspolnilos18')}</Text></CheckRow>
      <CheckRow left on={terms} onPress={() => setTerms(!terms)}><Text style={{ fontSize: 12 }}>{t('screens.obAge.yaPrinimayuUsloviyaI')}</Text></CheckRow>
      {/* The accepted documents must be one tap away (App Review 1.2: users agree to terms with no tolerance for abuse). */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <LinkBtn label={t('screens.legal.pravilaSoobschestva')} onPress={() => router.push('/community-rules')} />
        <LinkBtn label={t('screens.me.rowLegal')} onPress={() => router.push('/legal')} />
      </View>
      <SafeBanner>{t('screens.obAge.dataRozhdeniyaNeBudet')}</SafeBanner>
      <Btn label={t('screens.obAge.prodolzhit')} onPress={next} busy={busy} />
      <View><Btn kind="ghost" label={t('screens.obAge.sohranitChernovikIVyyti')} onPress={() => saveDraftAndExit(name.trim() ? { display_name: name.trim() } : {})} /></View>
      <Sheet visible={confirming} onClose={()=>setConfirming(false)}>
        <Text accessibilityRole="header" style={{fontSize:22}}>{t('identity.confirmBirthday')}</Text>
        <Text style={{fontSize:22,marginVertical:12}}>{birthdate}</Text>
        <Text>{t('identity.locked')}</Text>
        <Btn label={t('identity.confirmChoice')} onPress={persist} busy={busy}/>
        <Btn kind="ghost" label={t('identity.cancel')} onPress={()=>setConfirming(false)}/>
      </Sheet>
    </Screen>
  );
}
