import { useState } from 'react';
import { Text } from 'react-native';
import { Btn, Card, Choice, Field, Tiny } from '@/components/ui';
import { GENDERS } from '@/lib/catalog';
import { birthdateFromParts, ageOnDate } from '@/lib/identity';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

export default function IdentityCorrection({userId,onSaved}:{userId:string;onSaved?:()=>void|Promise<void>}) {
  const {t}=useLang();
  const [birthdate,setBirthdate]=useState('');
  const [gender,setGender]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const save=async()=>{
    const [y,m,d]=birthdate.split('-');const age=ageOnDate(birthdate);
    if(birthdateFromParts(d??'',m??'',y??'')!==birthdate || age===null || age<18 || age>120 || !GENDERS.some(g=>g.key===gender) || reason.trim().length<3){setMessage(t('identity.adminInvalid'));return;}
    setBusy(true);setMessage('');
    try {
      const {error}=await supabase.rpc('admin_correct_identity',{p_user:userId,p_birthdate:birthdate,p_gender:gender,p_reason:reason.trim()});
      if(error) throw error;
      setMessage(t('identity.adminSaved'));setReason('');await onSaved?.();
    }catch {setMessage(t('identity.adminFailed'));}finally{setBusy(false);}
  };
  return <Card>
    <Text style={{fontSize:16,fontWeight:'600'}}>{t('identity.adminHeading')}</Text>
    <Field label={t('identity.adminBirthday')} value={birthdate} onChangeText={setBirthdate} placeholder="1998-08-12" autoCapitalize="none" maxLength={10}/>
    <Tiny>{t('identity.adminGender')}</Tiny>
    {GENDERS.map(g=><Choice key={g.key} selected={gender===g.key} onPress={()=>setGender(g.key)}><Text>{t(g.labelKey)}</Text></Choice>)}
    <Field label={t('identity.adminReason')} value={reason} onChangeText={setReason} multiline maxLength={1000}/>
    {message?<Text accessibilityRole="alert">{message}</Text>:null}
    <Btn label={t('identity.adminSave')} onPress={save} busy={busy}/>
  </Card>;
}
