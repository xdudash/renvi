// Pure part of plus-sync (unit-tested): what does RevenueCat's subscriber record say about RENVI Plus?
// Plus = the `plus` entitlement is present and not expired. A trial is a subscription whose period_type is "trial".
export type Subscriber = {
  entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string } | undefined>;
  subscriptions?: Record<string, { period_type?: string; expires_date?: string | null } | undefined>;
};
export type PlusState = { expires: string | null; product: string | null; trial: boolean };

export function plusState(sub: Subscriber | null | undefined, entitlement: string, now: number): PlusState {
  const e = sub?.entitlements?.[entitlement];
  const none: PlusState = { expires: null, product: null, trial: false };
  if (!e) return none;
  // An entitlement without an expiry date is a lifetime grant (promotional); store it as a far date.
  const t = e.expires_date == null ? Date.parse('9999-12-31T00:00:00Z') : Date.parse(e.expires_date);
  if (!Number.isFinite(t) || t <= now) return none;
  const product = e.product_identifier ?? null;
  const trial = !!product && sub?.subscriptions?.[product]?.period_type === 'trial';
  return { expires: new Date(t).toISOString(), product, trial };
}
