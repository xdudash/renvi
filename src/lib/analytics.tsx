import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { useSession } from './session';
import { AnalyticsClock, AnalyticsTransport, acquisition, normalizeScreen } from './analyticsCore';

type ConsentContext = { enabled: boolean; loading: boolean; setConsent: (enabled: boolean) => Promise<void> };
const Context = createContext<ConsentContext>({ enabled: false, loading: true, setConsent: async () => {} });
export const useAnalyticsConsent = () => useContext(Context);

// No persisted identifier, local event queue or instrumentation exists before server consent is loaded.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
 const { session } = useSession();
 const uid = session?.user.id;
 const path = usePathname();
 const [state, setState] = useState<{uid?:string;enabled:boolean;loading:boolean}>({enabled:false,loading:true});
 const enabled = state.uid === uid && state.enabled;
 const generation = useRef(0);
 const engine = useRef<{ stop: () => void } | null>(null);
 useEffect(() => {
  const gen = ++generation.current;
  let cancelled=false;
  void (async()=>{
   if (!uid) { if(!cancelled) setState({uid,enabled:false,loading:false}); return; }
   const {data,error}=await supabase.rpc('analytics_consent');
   if (!cancelled && gen === generation.current) setState({uid,enabled:!error && data === true,loading:false});
  })();
  return () => { cancelled=true; };
 }, [uid]);
 const setConsent = useCallback(async (value: boolean) => {
  if (!uid) return;
  const gen = ++generation.current;
  // Close the collection boundary immediately, including if the revocation request later fails.
  engine.current?.stop();
  setState({uid,enabled:false,loading:true});
  const {error} = await supabase.rpc('analytics_set_consent',{p_enabled:value});
  if (gen !== generation.current) return;
  setState({uid,enabled:!error && value,loading:false});
  if (error) throw error;
 }, [uid]);
 const screen = useRef(normalizeScreen(path));
 const recordScreen = useRef<((next:string) => void) | null>(null);
 useEffect(() => { const next=normalizeScreen(path); recordScreen.current?.(next); screen.current=next; },[path]);
 useEffect(() => {
  if (!enabled || !uid) return;
  let stopped = false;
  let active = AppState.currentState === 'active' && (Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible');
  let sessionId = Crypto.randomUUID();
  let started = Date.now();
  const clock = new AnalyticsClock();
  clock.setConsent(true,Date.now()); clock.setActive(active,Date.now());
  const transport=new AnalyticsTransport(sessionId,screen.current,async packet => { await supabase.rpc('analytics_record',packet); });
  const send = (event:'screen_view'|'heartbeat',seconds=0) => { if(!stopped) { transport.session=sessionId; transport.send(event,seconds); } };
  const beat = () => {
   if (!active || stopped) return;
   const seconds=clock.tick(Date.now());
   if (Date.now()-started > 23*60*60*1000) { sessionId=Crypto.randomUUID(); started=Date.now(); }
   send('heartbeat',seconds);
  };
  const change = (next:boolean) => {
   if (next === active || stopped) return;
   if (active) beat();
   active=next; clock.setActive(next,Date.now());
   if (next) { sessionId=Crypto.randomUUID(); started=Date.now(); send('screen_view'); }
  };
  const stop = () => { stopped=true; transport.stop(); clock.setConsent(false,Date.now()); };
  engine.current={stop};
  recordScreen.current=next => { if(!stopped) transport.route(next,beat,active); };
  if(active) send('screen_view');
  // Read only the current launch URL after opt-in, allowlisting four attribution tokens.
  void Linking.getInitialURL().then(url => {
   if (!url || stopped) return;
   const a=acquisition(url);
   if (Object.values(a).some(Boolean)) void supabase.rpc('analytics_capture_acquisition',{p_source:a.source,p_medium:a.medium,p_campaign:a.campaign,p_referral:a.referral}).then(() => {});
  }).catch(()=>{});
  const subscription = AppState.addEventListener('change',s => change(s==='active'));
  const blur = AppState.addEventListener('blur',() => change(false));
  const focus = AppState.addEventListener('focus',() => change(AppState.currentState==='active'));
  const visibility = () => change(document.visibilityState==='visible' && AppState.currentState==='active');
  if (Platform.OS==='web' && typeof document!=='undefined') document.addEventListener('visibilitychange',visibility);
  const timer=setInterval(beat,30000);
  return () => {
   stop(); clearInterval(timer); subscription.remove(); blur.remove(); focus.remove();
   if (Platform.OS==='web' && typeof document!=='undefined') document.removeEventListener('visibilitychange',visibility);
   engine.current=null; recordScreen.current=null;
  };
 },[enabled,uid]);
 return <Context.Provider value={{enabled,loading:state.uid!==uid || state.loading,setConsent}}>{children}</Context.Provider>;
}
