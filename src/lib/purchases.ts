// RevenueCat over App Store / Google Play. The app only starts the store flow;
// the plan is switched on the server by the revenuecat-webhook function after the store confirms.
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

let configuredFor: string | null = null;
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

export type PlanOffer = { tier: 'plus' | 'premium'; period: 'month' | 'year'; pkg: PurchasesPackage; price: string; productId: string };

// Packages are expected in the "default" offering with identifiers like plus_month, plus_year, premium_month, premium_year.
export async function loadOffers(): Promise<PlanOffer[]> {
  if (!purchasesAvailable()) return [];
  const o = await Purchases.getOfferings();
  const pkgs = o.current?.availablePackages ?? [];
  return pkgs.flatMap((p) => {
    const m = /^(plus|premium)_(month|year)$/.exec(p.identifier);
    return m ? [{ tier: m[1] as 'plus' | 'premium', period: m[2] as 'month' | 'year', pkg: p, price: p.product.priceString, productId: p.product.identifier }] : [];
  });
}

export type BuyResult = { status: 'ok' | 'cancelled' | 'error'; productId: string | null };

// currentProductId: the store product of the plan the user has now (server subscriptions.product_id). On Google Play
// a change of plan must name the subscription it replaces, otherwise Play starts a second, parallel subscription.
export async function buy(offer: PlanOffer, currentProductId?: string | null): Promise<BuyResult> {
  try {
    const change = Platform.OS === 'android' && currentProductId && currentProductId !== offer.productId
      ? { oldProductIdentifier: currentProductId.split(':')[0] }
      : null;
    const r = await Purchases.purchasePackage(offer.pkg, null, change);
    return { status: 'ok', productId: r?.productIdentifier ?? offer.productId };
  } catch (e: any) {
    return { status: e?.userCancelled ? 'cancelled' : 'error', productId: null };
  }
}

export async function restore(): Promise<'ok' | 'error'> {
  try { await Purchases.restorePurchases(); return 'ok'; } catch { return 'error'; }
}

// Re-sends the store receipts to RevenueCat without the restore UI (used when the server has not caught up yet).
export async function syncPurchases(): Promise<'ok' | 'error'> {
  try { await Purchases.syncPurchases(); return 'ok'; } catch { return 'error'; }
}

export async function manageSubscriptions(): Promise<void> {
  if (!purchasesAvailable()) return;
  await Purchases.showManageSubscriptions();
}
