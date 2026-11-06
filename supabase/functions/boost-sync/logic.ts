// Pure part of boost-sync (unit-tested): which store purchases are plan boosts, and how long does each last?
export type NonSub = { id?: string; store_transaction_id?: string; purchase_date?: string };
export type Subscriber = { non_subscriptions?: Record<string, NonSub[] | undefined> };
export const BOOSTS: Record<string, number> = { renvi_boost_3h: 3, renvi_boost_24h: 24 };

export function boostPurchases(sub: Subscriber | null | undefined): { tx: string; product: string; hours: number }[] {
  const out: { tx: string; product: string; hours: number }[] = [];
  for (const [product, hours] of Object.entries(BOOSTS)) {
    for (const t of sub?.non_subscriptions?.[product] ?? []) {
      const tx = t.store_transaction_id || t.id;
      if (tx) out.push({ tx: String(tx), product, hours });
    }
  }
  return out;
}
