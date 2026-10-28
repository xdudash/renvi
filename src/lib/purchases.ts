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

export type PlanOffer = { tier: 'plus' | 'premium'; period: 'month' | 'year'; pkg: PurchasesPackage; price: string };

// Packages are expected in the "default" offering with identifiers like plus_month, plus_year, premium_month, premium_year.
export async function loadOffers(): Promise<PlanOffer[]> {
  if (!purchasesAvailable()) return [];
  const o = await Purchases.getOfferings();
  const pkgs = o.current?.availablePackages ?? [];
  return pkgs.flatMap((p) => {
    const m = /^(plus|premium)_(month|year)$/.exec(p.identifier);
    return m ? [{ tier: m[1] as 'plus' | 'premium', period: m[2] as 'month' | 'year', pkg: p, price: p.product.priceString }] : [];
  });
}

export async function buy(offer: PlanOffer): Promise<'ok' | 'cancelled' | 'error'> {
  try {
    await Purchases.purchasePackage(offer.pkg);
    return 'ok';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'error';
  }
}

export async function restore(): Promise<'ok' | 'error'> {
  try { await Purchases.restorePurchases(); return 'ok'; } catch { return 'error'; }
}

export async function manageSubscriptions(): Promise<void> {
  if (!purchasesAvailable()) return;
  await Purchases.showManageSubscriptions();
}
