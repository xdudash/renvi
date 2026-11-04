// One in-app purchase: RENVI Playbook (non-consumable, store product `renvi_playbook`, RevenueCat entitlement
// `playbook`). The app only runs the store flow; access on the server is switched by the playbook-sync Edge
// Function, which asks RevenueCat directly (the client never writes `purchased`).
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PRODUCT_CATEGORY, type CustomerInfo, type PurchasesStoreProduct } from 'react-native-purchases';

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
