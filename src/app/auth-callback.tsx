import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Screen, Loading, StateBlock } from '@/components/ui';
import { establishConfirmationSession } from '@/lib/confirmationAuth';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

export default function AuthCallback() {
  const {t}=useLang(); const {refresh}=useSession();
  const url=Linking.useLinkingURL();
  const [phase,setPhase]=useState<'checking'|'confirmed'|'invalid'>('checking');
  useEffect(()=>{
    let alive=true;
    (async()=>{
      const incoming=Platform.OS==='web' && typeof window!=='undefined'?window.location.href:url??await Linking.getInitialURL();
      let ok=false; try {ok=await establishConfirmationSession(incoming);} catch {ok=false;}
      if(!alive) return;
      if(Platform.OS==='web' && typeof window!=='undefined') window.history.replaceState(null,'',window.location.pathname);
      if(ok) await refresh();
      if(alive) setPhase(ok?'confirmed':'invalid');
    })();
    return()=>{alive=false;};
  },[url,refresh]);
  return <Screen>{phase==='checking'?<Loading label={t('identity.checking')}/>:phase==='confirmed'
    ?<StateBlock icon="✓" title={t('identity.confirmed')} copy={t('identity.confirmedCopy')} label={t('identity.continue')} onPress={()=>router.replace('/')} />
    :<StateBlock icon="✉" title={t('identity.expiredTitle')} copy={t('identity.expiredCopy')} label={t('identity.requestNew')} onPress={()=>router.replace('/confirmation')} />}</Screen>;
}
