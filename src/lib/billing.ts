// Pure billing helpers for the plan and purchase screens (no React Native imports, unit-tested with bun).
export type Tier = 'free' | 'plus' | 'premium';
export type Period = 'month' | 'year';
export type ServerSub = { tier: string; expires_at: string | null; product_id?: string | null };

const RANK: Record<Tier, number> = { free: 0, plus: 1, premium: 2 };
const asTier = (t: string | null | undefined): Tier => (t === 'plus' || t === 'premium' ? t : 'free');

/** Tier the server row gives right now (an expired row counts as free). */
export function serverTier(sub: ServerSub | null | undefined, nowMs: number): Tier {
  if (!sub) return 'free';
  if (sub.expires_at && Date.parse(sub.expires_at) <= nowMs) return 'free';
  return asTier(sub.tier);
}

/** Store product of the active plan, or null (free / expired / unknown). */
export function serverProduct(sub: ServerSub | null | undefined, nowMs: number): string | null {
  return serverTier(sub, nowMs) === 'free' ? null : sub?.product_id ?? null;
}

/** Billing period of a store product id, looked up in the loaded offers (exact product id match only). */
export function periodOfProduct(productId: string | null | undefined, offers: { period: Period; productId: string }[]): Period | null {
  if (!productId) return null;
  return offers.find((o) => o.productId === productId)?.period ?? null;
}

/**
 * "Continue" on the plan screen. Free → nothing to buy when already free. Same paid tier → allowed only for a
 * different period; when the current period is unknown it stays allowed (the store refuses a real duplicate).
 */
export function canContinue(selected: Tier, current: Tier, currentPeriod: Period | null, period: Period): boolean {
  if (selected !== current) return true;
  if (selected === 'free') return false;
  return currentPeriod == null || currentPeriod !== period;
}

export type Expectation = { tier: Exclude<Tier, 'free'>; productId: string | null; previousTier: Tier; previousProduct: string | null };

/**
 * After the store said OK: has the server applied the purchase?
 *  - 'confirmed': the server tier is the bought tier (for a period change within the tier: the product changed too);
 *  - 'scheduled': a downgrade or period change the store applies at the next renewal, the server still shows the old plan;
 *  - 'waiting'  : not yet.
 * `final` = the last check of a polling round (only then a not-yet-applied change is reported as scheduled).
 */
export function purchaseVerdict(exp: Expectation, sub: ServerSub | null, nowMs: number, final: boolean): 'confirmed' | 'scheduled' | 'waiting' {
  const tier = serverTier(sub, nowMs);
  const product = serverProduct(sub, nowMs);
  const sameTierChange = exp.previousTier === exp.tier;
  if (tier === exp.tier) {
    if (!sameTierChange || !exp.productId) return 'confirmed';
    if (product === exp.productId) return 'confirmed';
    // Same tier, product not switched yet (Apple: a crossgrade to another duration starts at the next renewal).
    return final && product === exp.previousProduct ? 'scheduled' : 'waiting';
  }
  // Downgrade (e.g. Premium → Plus): stores keep the higher plan until the paid period ends.
  if (final && RANK[tier] > RANK[exp.tier] && tier === exp.previousTier) return 'scheduled';
  return 'waiting';
}
