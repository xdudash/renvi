import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { authRedirect, planEmailConfirmation } from './identity';

export function confirmationRedirectUrl():string {
  // Native: Linking.createURL gives renvi://auth-callback in store/TestFlight builds and exp://…/--/auth-callback in Expo Go,
  // so the e-mail button reopens whichever app sent it.
  if (Platform.OS!=='web') return Linking.createURL('auth-callback');
  return authRedirect('auth-callback',typeof window!=='undefined'?window.location.origin:undefined,process.env.EXPO_PUBLIC_BASE_PATH??'');
}
const attempts=new Map<string,Promise<boolean>>();
export function establishConfirmationSession(url:string|null):Promise<boolean> {
  if (!url) return Promise.resolve(false);
  const hit=attempts.get(url); if (hit) return hit;
  const result=establish(url); attempts.set(url,result);
  result.then(ok=>{if(!ok) attempts.delete(url);},()=>attempts.delete(url));
  return result;
}
async function establish(url:string):Promise<boolean> {
  const plan=planEmailConfirmation(url);
  if (plan.kind==='invalid') return false;
  const result=plan.kind==='exchange'?await supabase.auth.exchangeCodeForSession(plan.code)
    :plan.kind==='verify'?await supabase.auth.verifyOtp({token_hash:plan.tokenHash,type:plan.type})
      :await supabase.auth.setSession({access_token:plan.accessToken,refresh_token:plan.refreshToken});
  if (result.error) return false;
  // Server lookup is essential: a session alone does not prove an email was confirmed.
  const {data,error}=await supabase.auth.getUser();
  return !error && !!data.user?.email_confirmed_at;
}
