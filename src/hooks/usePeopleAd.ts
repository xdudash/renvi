import { useRef } from 'react';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { AD_EVERY, stashAd } from '@/lib/adSlots';
import { useMyTier } from '@/lib/tier';

/**
 * Free accounts: after every AD_EVERY-th person (spark, pass, hello) a partner card opens, but only when an ad is booked.
 * Plus never gets one. `from` decides which tab the card sits in («Свидания» or «Компания»).
 */
export function usePeopleAd(from: 'discover' | 'company') {
  const { tier } = useMyTier();
  const shown = useRef(0);
  return () => {
    shown.current += 1;
    if (!tier || tier.plus || shown.current % AD_EVERY !== 0) return;
    api.adNext('people').then((ad) => { if (ad) { stashAd(ad); router.push({ pathname: '/people-ad', params: { from } }); } }, () => {});
  };
}
