import { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn } from './ui';
import { useAnalyticsConsent } from '@/lib/analytics';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
export function AnalyticsConsent() {
 const {t}=useLang();
 const {enabled,loading,setConsent}=useAnalyticsConsent();
 const [error,setError]=useState(false);
 const [attempted,setAttempted]=useState<boolean|null>(null);
 const save=async()=>{const target=error && attempted!==null?attempted:!enabled;setAttempted(target);setError(false);try {await setConsent(target);} catch {setError(true);}};
 return <View style={{gap:10,paddingVertical:16}}>
  <Text accessibilityRole="header" style={{fontSize:18,fontWeight:'700',color:colors.ink}}>{t('analytics.consentTitle')}</Text>
  <Text style={{color:colors.sub}}>{t('analytics.consentCopy')}</Text>
  <Text style={{color:colors.ink}}>{t(enabled?'analytics.consentOn':'analytics.consentOff')}</Text>
  <Btn kind="secondary" label={t(error?'adm.common.retry':enabled?'analytics.disable':'analytics.enable')} onPress={()=>{void save();}} disabled={loading} />
  {error?<Text accessibilityRole="alert" style={{color:colors.red}}>{t('analytics.saveError')}</Text>:null}
 </View>;
}
