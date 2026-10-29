import { parseRecoveryUrl } from './recovery.ts';

export function birthdateFromParts(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const d=Number(day),m=Number(month),y=Number(year);
  if (y<1900 || m<1 || m>12 || d<1) return null;
  const leap=y%4===0 && (y%100!==0 || y%400===0);
  if (d>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1]) return null;
  return `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function ageOnDate(birthdate: string, now: Date=new Date()): number | null {
  const [y,m,d]=birthdate.split('-').map(Number);
  if (birthdateFromParts(String(d),String(m),String(y))!==birthdate) return null;
  const today=`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
  if (birthdate>today) return null;
  return now.getUTCFullYear()-y-((now.getUTCMonth()+1<m || (now.getUTCMonth()+1===m && now.getUTCDate()<d))?1:0);
}
export type ConfirmationPlan =
  | {kind:'exchange';code:string}
  | {kind:'verify';tokenHash:string;type:'signup'|'email'}
  | {kind:'setSession';accessToken:string;refreshToken:string}
  | {kind:'invalid'};
export function planEmailConfirmation(url:string|null):ConfirmationPlan {
  const p=parseRecoveryUrl(url);
  if (p.error || (p.type && !['signup','email'].includes(p.type))) return {kind:'invalid'};
  if (p.code) return {kind:'exchange',code:p.code};
  if (p.tokenHash && (p.type==='signup' || p.type==='email')) return {kind:'verify',tokenHash:p.tokenHash,type:p.type};
  if (p.accessToken && p.refreshToken) return {kind:'setSession',accessToken:p.accessToken,refreshToken:p.refreshToken};
  return {kind:'invalid'};
}
export function authRedirect(path:'auth-callback'|'reset-password',origin?:string,base=''):string {
  return origin?`${origin}${base.replace(/\/+$/,'').replace(/^([^/])/,'/$1')}/${path}`:`renvi://${path}`;
}
