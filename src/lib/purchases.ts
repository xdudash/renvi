// One in-app purchase: RENVI Playbook (non-consumable, store product `renvi_playbook`, RevenueCat entitlement
// `playbook`). The app only runs the store flow; access on the server is switched by the playbook-sync Edge
// Function, which asks RevenueCat directly (the client never writes `purchased`).
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Purchases, { LOG_LEVEL, PRODUCT_CATEGORY, type CustomerInfo, type PurchasesPackage, type PurchasesStoreProduct } from 'react-native-purchases';

export const PLAYBOOK_PRODUCT = 'renvi_playbook';
export const PLAYBOOK_ENTITLEMENT = 'playbook';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

let configuredFor: string | null = null;

/** False on web and in builds without a RevenueCat key: the paywall then explains where to buy. */
export const purchasesAvailable = () => Platform.OS !== 'web' && !!KEY;

export async function initPurchases(userId: string) {
  if (!purchasesAvailable() || configuredFor === userId) return;
  if (!configuredFor) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: KEY!, appUserID: userId });
  } else {
    await Purchases.logIn(userId);
  }
  configuredFor = userId;
}

const owns = (info: CustomerInfo) =>
  !!info.entitlements.active[PLAYBOOK_ENTITLEMENT]
  || info.nonSubscriptionTransactions.some((t) => t.productIdentifier === PLAYBOOK_PRODUCT);

let product: PurchasesStoreProduct | null = null;

/** Store price as the store formats it ("0,99 €"); null when the store is unavailable. */
export async function playbookPrice(): Promise<string | null> {
  if (!purchasesAvailable()) return null;
  try {
    if (!product) product = (await Purchases.getProducts([PLAYBOOK_PRODUCT], PRODUCT_CATEGORY.NON_SUBSCRIPTION))[0] ?? null;
    return product?.priceString ?? null;
  } catch {
    return null;
  }
}

export type BuyResult = 'ok' | 'cancelled' | 'error';

export async function buyPlaybook(): Promise<BuyResult> {
  if (!purchasesAvailable()) return 'error';
  try {
    if (!product) product = (await Purchases.getProducts([PLAYBOOK_PRODUCT], PRODUCT_CATEGORY.NON_SUBSCRIPTION))[0] ?? null;
    if (!product) return 'error';
    const r = await Purchases.purchaseStoreProduct(product);
    return owns(r.customerInfo) ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

export async function restorePlaybook(): Promise<'ok' | 'none' | 'error'> {
  if (!purchasesAvailable()) return 'error';
  try {
    return owns(await Purchases.restorePurchases()) ? 'ok' : 'none';
  } catch {
    return 'error';
  }
}

/** Whether the store already knows this user owns the course (used while the server catches up). */
export async function ownsPlaybookInStore(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  try { return owns(await Purchases.getCustomerInfo()); } catch { return false; }
}

// ---------------------------------------------------------------------------------------------------------------
// RENVI Plus (auto-renewing subscription, RevenueCat entitlement `plus`) and plan boosts (consumables).
// Access is switched on the server by the plus-sync / boost-sync Edge Functions; the app only runs the store flow.
// RevenueCat dashboard: offering "default" with packages $rc_monthly (renvi_plus_monthly, 4,99 € with a 7-day free trial)
// and $rc_annual (renvi_plus_yearly, 29,99 €); consumables renvi_boost_3h (0,99 €) and renvi_boost_24h (2,49 €).
// ---------------------------------------------------------------------------------------------------------------
export const BOOST_PRODUCTS = { 3: 'renvi_boost_3h', 24: 'renvi_boost_24h' } as const;
export type PlusPeriod = 'monthly' | 'yearly';
export type PlusOffer = { period: PlusPeriod; price: string; perMonth: string | null; trialDays: number | null; pkg: PurchasesPackage };

export async function plusOffers(): Promise<PlusOffer[] | null> {
  if (!purchasesAvailable()) return null;
  try {
    const cur = (await Purchases.getOfferings()).current;
    if (!cur) return null;
    const mk = (period: PlusPeriod, pkg: PurchasesPackage | null): PlusOffer | null => {
      if (!pkg) return null;
      const intro = pkg.product.introPrice;
      const trialDays = intro && intro.price === 0 ? (intro.periodUnit === 'DAY' ? intro.periodNumberOfUnits : intro.periodUnit === 'WEEK' ? intro.periodNumberOfUnits * 7 : null) : null;
      return { period, price: pkg.product.priceString, perMonth: period === 'yearly' ? (pkg.product.pricePerMonthString ?? null) : null, trialDays, pkg };
    };
    return [mk('monthly', cur.monthly), mk('yearly', cur.annual)].filter((x): x is PlusOffer => !!x);
  } catch {
    return null;
  }
}

export async function buyPlus(offer: PlusOffer): Promise<BuyResult> {
  if (!purchasesAvailable()) return 'error';
  try {
    const r = await Purchases.purchasePackage(offer.pkg);
    return r.customerInfo.entitlements.active.plus ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

export async function restorePlus(): Promise<'ok' | 'none' | 'error'> {
  if (!purchasesAvailable()) return 'error';
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active.plus ? 'ok' : 'none';
  } catch {
    return 'error';
  }
}

/** Asks the server to re-read the store (renewals, expiry, refunds). Returns whether the account is Plus now. */
export async function syncPlus(attempts = 3): Promise<boolean | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.functions.invoke('plus-sync', { body: {} });
    if (!error && data && typeof (data as { plus?: boolean }).plus === 'boolean') return (data as { plus: boolean }).plus;
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return null;
}

let boostProducts: Partial<Record<3 | 24, PurchasesStoreProduct>> = {};
/** Store prices of the two boosts ("0,99 €"); null when the store is unavailable. */
export async function boostPrices(): Promise<Record<3 | 24, string> | null> {
  if (!purchasesAvailable()) return null;
  try {
    const list = await Purchases.getProducts([BOOST_PRODUCTS[3], BOOST_PRODUCTS[24]], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    for (const p of list) { if (p.identifier === BOOST_PRODUCTS[3]) boostProducts[3] = p; if (p.identifier === BOOST_PRODUCTS[24]) boostProducts[24] = p; }
    return boostProducts[3] && boostProducts[24] ? { 3: boostProducts[3].priceString, 24: boostProducts[24].priceString } : null;
  } catch {
    return null;
  }
}

export async function buyBoost(hours: 3 | 24): Promise<BuyResult> {
  if (!purchasesAvailable()) return 'error';
  try {
    if (!boostProducts[hours]) await boostPrices();
    const p = boostProducts[hours];
    if (!p) return 'error';
    await Purchases.purchaseStoreProduct(p);
    return 'ok';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

/** Applies the caller's paid boosts to the plan on the server. Returns the new end time or null. */
export async function syncBoost(planId: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.functions.invoke('boost-sync', { body: { plan_id: planId } });
    const d = data as { applied?: number; boosted_until?: string | null } | null;
    if (!error && d && (d.applied ?? 0) > 0 && d.boosted_until) return d.boosted_until;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}
