// Pure part of playbook-sync (unit-tested): does RevenueCat's subscriber record give access to the Playbook?
// Access = the `playbook` entitlement is present and not expired. Refunds remove the entitlement in RevenueCat.
export type Subscriber = { entitlements?: Record<string, { expires_date?: string | null } | undefined> };

export function ownsPlaybook(sub: Subscriber | null | undefined, entitlement: string, now: number): boolean {
  const e = sub?.entitlements?.[entitlement];
  if (!e) return false;
  if (e.expires_date == null) return true; // non-consumable: no expiry
  const t = Date.parse(e.expires_date);
  return Number.isFinite(t) && t > now;
}
