import type { AdCard } from './api';

/** A partner card is shown after this many people in the «Свидания»/«Компания» stack (Free accounts only). */
export const AD_EVERY = 12;

// The ad is fetched before the screen opens (so a stack without a booked ad never shows an empty interstitial)
// and handed over once.
let stash: AdCard | null = null;
export const stashAd = (ad: AdCard | null) => { stash = ad; };
export const takeAd = (): AdCard | null => { const a = stash; stash = null; return a; };
