// Pure consent/timing boundary. Never accept arbitrary path segments or event payloads.
export class AnalyticsClock {
  private consent = false;
  private active = false;
  private last = 0;
  setConsent(value: boolean, now: number) { this.consent = value; this.last = now; }
  setActive(value: boolean, now: number) { this.active = value; this.last = now; }
  tick(now: number) {
    const seconds = this.consent && this.active ? Math.min(30, Math.max(0, Math.floor((now - this.last) / 1000))) : 0;
    this.last = Math.max(this.last, now);
    return seconds;
  }
}
const SCREENS = new Set(['index','welcome','signin','signup','onboarding','discover','likes','matches','chat','profile','settings','privacy-data','date','match','subscription','admin']);
export function normalizeScreen(path: string) {
 const first = path.split('?')[0].split('/').filter(x => x && !x.startsWith('('))[0] ?? 'index';
 if (first.startsWith('ob-') || first.startsWith('onboarding')) return 'onboarding';
 if (first==='chats') return 'matches';
 if (first==='me') return 'profile';
 if (first==='plans' || first.startsWith('purchase')) return 'subscription';
 if (first.startsWith('date')) return 'date';
 return SCREENS.has(first) ? first : 'other';
}
export function acquisition(url: string) {
 const safe = (value: string | null) => value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
 try {
  const p = new URL(url).searchParams;
  return { source:safe(p.get('utm_source')), medium:safe(p.get('utm_medium')), campaign:safe(p.get('utm_campaign')), referral:safe(p.get('ref')) };
 } catch { return {source:null,medium:null,campaign:null,referral:null}; }
}
export type AnalyticsPacket = { p_session:string; p_event:'screen_view'|'heartbeat'; p_screen:string; p_seconds:number };
// Snapshot context at enqueue time, serialize requests, and flush the OLD screen before switching.
export class AnalyticsTransport {
 private tail:Promise<void> = Promise.resolve();
 private stopped=false;
 public session:string;
 public screen:string;
 private emit:(packet:AnalyticsPacket)=>Promise<unknown>;
 constructor(session:string,screen:string,emit:(packet:AnalyticsPacket)=>Promise<unknown>) { this.session=session;this.screen=screen;this.emit=emit; }
 send(event:AnalyticsPacket['p_event'],seconds=0) {
  const packet={p_session:this.session,p_event:event,p_screen:this.screen,p_seconds:seconds};
  this.tail=this.tail.then(async()=>{if(!this.stopped) await this.emit(packet);}).catch(()=>{});
 }
 route(next:string,flush:()=>void,active:boolean) {
  if(active) flush();
  this.screen=next;
  if(active) this.send('screen_view');
 }
 stop(){this.stopped=true;}
 drained(){return this.tail;}
}
