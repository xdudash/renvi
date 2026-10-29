import assert from 'node:assert/strict';
import { test } from 'node:test';
process.env.SUPABASE_URL='http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-placeholder';
const {ensureConfirmedFixture}=await import('../../e2e/api.mjs');
test('fixture helper cannot confirm a real email',async()=>{
 await assert.rejects(()=>ensureConfirmedFixture('person@example.com','test-password'),/fixture/i);
});
test('service fixtures are explicitly confirmed, then sign in; normal signup is not used',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return new Response(JSON.stringify(url.includes('/admin/users')?{id:'fixture'}:{access_token:'token',user:{id:'fixture'}}));
 };
 try {assert.equal((await ensureConfirmedFixture('fixture@renvi.test','test-password')).access_token,'token');}
 finally {globalThis.fetch=original;}
 assert.equal(calls[0].body.email_confirm,true);
 assert.ok(calls[0].url.endsWith('/admin/users'));
 assert.ok(calls[1].url.includes('/token?grant_type=password'));
});
