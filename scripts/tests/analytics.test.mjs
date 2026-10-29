import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsClock, normalizeScreen, acquisition } from '../../src/lib/analyticsCore.ts';
test('only consented foreground time is measured and background never leaks', () => {
 const c = new AnalyticsClock();
 assert.equal(c.tick(10000), 0);
 c.setConsent(true, 10000); c.setActive(true, 10000);
 assert.equal(c.tick(15000), 5);
 c.setActive(false, 18000);
 assert.equal(c.tick(90000), 0);
 c.setActive(true, 90000); assert.equal(c.tick(92000), 2);
 c.setConsent(false, 93000); assert.equal(c.tick(99000), 0);
});
test('delayed heartbeat is capped and clocks moving backwards add no time', () => {
 const c = new AnalyticsClock(); c.setConsent(true, 0); c.setActive(true, 0);
 assert.equal(c.tick(120000), 30); assert.equal(c.tick(110000), 0);
});
test('screen ids and query values cannot disclose ids or text', () => {
 assert.equal(normalizeScreen('/chat/secret-user?message=private'), 'chat');
 assert.equal(normalizeScreen('/admin/user/private-id'), 'admin');
 assert.equal(normalizeScreen('/unexpected/private-id'), 'other');
 assert.deepEqual(acquisition('https://renvi.app/?utm_source=mail&utm_campaign=launch&email=secret'), {source:'mail',medium:null,campaign:'launch',referral:null});
 assert.equal(acquisition('https://renvi.app/?utm_source=person@example.com').source, null);
});
test('actual transport flushes old screen before the new view, serializing pending RPCs', async () => {
 const {AnalyticsTransport}=await import('../../src/lib/analyticsCore.ts');
 const packets=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const transport=new AnalyticsTransport('session-1','discover',async packet=>{packets.push(packet);if(packets.length===1)await gate;});
 transport.send('screen_view');
 await Promise.resolve();
 transport.route('chat',()=>transport.send('heartbeat',12),true);
 assert.equal(packets.length,1); // pending initial RPC gates heartbeat/new view
 release();await transport.drained();
 assert.deepEqual(packets.map(p=>[p.p_event,p.p_screen,p.p_seconds]),[['screen_view','discover',0],['heartbeat','discover',12],['screen_view','chat',0]]);
});
test('revocation cancels queued events and background routes emit nothing',async()=>{
 const {AnalyticsTransport}=await import('../../src/lib/analyticsCore.ts');
 const packets=[];const t=new AnalyticsTransport('s','discover',async p=>packets.push(p));
 t.route('settings',()=>assert.fail('background must not flush'),false);
 await t.drained();assert.equal(packets.length,0);
 t.send('screen_view');t.stop();await t.drained();assert.equal(packets.length,0);
});
test('real app route names normalize without storing arbitrary dynamic ids',()=>{
 assert.equal(normalizeScreen('/ob-birthday'),'onboarding');assert.equal(normalizeScreen('/chats'),'matches');assert.equal(normalizeScreen('/me'),'profile');assert.equal(normalizeScreen('/plans'),'other');
});

test('invite routes preserve limited referral attribution on web and native',()=>{
 assert.equal(acquisition('https://host/renvi/invite/RN-1234').referral,'RN-1234');
 assert.equal(acquisition('renvi://invite/RN-1234').referral,'RN-1234');
 assert.equal(acquisition('https://host/invite/person@example.com').referral,null);
});
