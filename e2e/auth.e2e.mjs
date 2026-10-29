import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { APP, URL as API, ANON, signIn } from './api.mjs';
import { waitForAuthEmail } from './mail.mjs';
import { createRunner } from './steps.mjs';

const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:393,height:852}});
const page=await ctx.newPage();
const {step,finish}=createRunner({label:'email-auth',stopOnFail:true});
const email=`auth-${Date.now()}@renvi.test`,original='renvi-test-1',replacement='renvi-test-2';
let first,resent;
const send=async(path,body)=>{
  const r=await fetch(API+'/auth/v1/'+path,{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(r.ok,true,`Auth ${path} request failed (${r.status})`);
  return r.json();
};
await step('signup requires actual confirmation',async()=>{
  const after=Date.now();
  const response=await send('signup?redirect_to='+encodeURIComponent(APP+'/auth-callback'),{email,password:original});
  assert.equal(response.access_token,undefined,'Confirm Email must be enabled in local Auth config');
  await assert.rejects(()=>signIn(email,original),/confirm/i);
  first=await waitForAuthEmail(email,{after});
});
await step('resend email and confirm on fresh device',async()=>{
  const after=Date.now();
  await page.goto(APP+'/confirmation?email='+encodeURIComponent(email),{waitUntil:'networkidle'});
  await page.getByText('Отправить ещё раз',{exact:true}).click();
  resent=await waitForAuthEmail(email,{after,excludeIds:[first.id]});
  await page.goto(resent.link,{waitUntil:'networkidle'});
  await page.getByText('Почта подтверждена',{exact:true}).first().waitFor({timeout:15000});
  assert.equal(new URL(page.url()).search,'','callback removes token from address bar');
  assert.ok((await signIn(email,original)).access_token);
});
await step('used signup callback offers new email',async()=>{
  const fresh=await browser.newContext();const p=await fresh.newPage();
  await p.goto(resent.link,{waitUntil:'networkidle'});
  await p.getByText('Ссылка недействительна',{exact:true}).waitFor({timeout:15000});
  await p.getByText('Запросить новое письмо',{exact:true}).click();
  await p.getByRole('textbox').fill(email);
  await fresh.close();
});
await step('expired callback offers recovery path',async()=>{
  await page.goto(APP+'/auth-callback#error=access_denied&error_code=otp_expired',{waitUntil:'networkidle'});
  await page.getByText('Ссылка недействительна',{exact:true}).waitFor();
});
await step('recover password from actual email on fresh device',async()=>{
  const fresh=await browser.newContext();const p=await fresh.newPage();
  await p.goto(APP+'/forgot',{waitUntil:'networkidle'});
  await p.getByPlaceholder('name@example.com').fill(email);
  const after=Date.now();
  await p.getByText('Отправить ссылку',{exact:true}).click();
  const mail=await waitForAuthEmail(email,{kind:'recovery',after});
  await p.goto(mail.link,{waitUntil:'networkidle'});
  await p.getByText('Придумайте новый пароль',{exact:true}).waitFor({timeout:15000});
  await p.locator('input[type="password"]').nth(0).fill(replacement);
  await p.locator('input[type="password"]').nth(1).fill(replacement);
  await p.getByText('Сохранить пароль',{exact:true}).click();
  await p.waitForURL(url=>url.pathname==='/',{timeout:15000});
  await assert.rejects(()=>signIn(email,original));
  assert.ok((await signIn(email,replacement)).access_token);
  await fresh.close();
  const used=await browser.newContext();const invalid=await used.newPage();
  await invalid.goto(mail.link,{waitUntil:'networkidle'});
  await invalid.getByText('Ссылка недействительна',{exact:true}).waitFor({timeout:15000});
  await used.close();
});
await finish(()=>browser.close());
