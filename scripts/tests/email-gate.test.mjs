import assert from 'node:assert/strict';
import {gateTarget} from '../../src/lib/gateRoutes.ts';
const now=new Date();
assert.equal(gateTarget('/discover',true,{onboarding_done:true},false,now,false),'/confirmation');
for(const p of ['/auth-callback','/confirmation','/reset-password','/delete-account','/data-export','/support-help']) assert.equal(gateTarget(p,true,null,false,now,false),null,p);
assert.equal(gateTarget('/auth-callback',false,null),null);
assert.equal(gateTarget('/discover',true,{onboarding_done:true},false,now,true),null);
console.log('verified-email gate checks passed');
