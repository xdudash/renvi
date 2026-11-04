import { expect, test } from 'bun:test';
import { ownsPlaybook } from '../functions/playbook-sync/logic.ts';

const now = Date.parse('2026-11-04T12:00:00Z');

test('no subscriber or no entitlement: no access', () => {
  expect(ownsPlaybook(null, 'playbook', now)).toBe(false);
  expect(ownsPlaybook({}, 'playbook', now)).toBe(false);
  expect(ownsPlaybook({ entitlements: { other: { expires_date: null } } }, 'playbook', now)).toBe(false);
});

test('lifetime entitlement gives access', () => {
  expect(ownsPlaybook({ entitlements: { playbook: { expires_date: null } } }, 'playbook', now)).toBe(true);
  expect(ownsPlaybook({ entitlements: { playbook: {} } }, 'playbook', now)).toBe(true);
});

test('expired or broken expiry: no access', () => {
  expect(ownsPlaybook({ entitlements: { playbook: { expires_date: '2026-11-01T00:00:00Z' } } }, 'playbook', now)).toBe(false);
  expect(ownsPlaybook({ entitlements: { playbook: { expires_date: 'soon' } } }, 'playbook', now)).toBe(false);
  expect(ownsPlaybook({ entitlements: { playbook: { expires_date: '2027-01-01T00:00:00Z' } } }, 'playbook', now)).toBe(true);
});
