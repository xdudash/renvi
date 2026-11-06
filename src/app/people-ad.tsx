import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { AdCard } from '@/components/AdCard';
import { PeopleHead } from '@/components/PeopleHead';
import { LoadingCards } from '@/components/LoadingCards';
import { ErrorRetryState, OfflineState } from '@/components/States';
import { Btn, Screen, StateBlock } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api, type AdCard as Ad } from '@/lib/api';
import { AD_EVERY, takeAd } from '@/lib/adSlots';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// people-ad · a partner card between people (every AD_EVERY-th card, Free only). Plus and "no ad booked" see no card.
export default function PeopleAd() {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync<Ad | null>(async () => takeAd() ?? api.adNext('people'), []);
  const next = () => (router.canGoBack() ? router.back() : router.replace('/discover'));
  let body: React.ReactNode;
  if (loading && data === null) body = <LoadingCards />;
  else if (error?.kind === 'offline') body = <OfflineState onRetry={reload} />;
  else if (error) body = <ErrorRetryState onRetry={reload} />;
  else if (!data) body = <StateBlock icon="▷" title={t('ad.none')} copy={t('ad.noneCopy')} />;
  else body = (
    <AdCard ad={data} label={t('ad.peopleOf', { n: AD_EVERY })} aside={
      <Pressable accessibilityRole="link" onPress={() => router.push('/plans')}><Text style={{ fontSize: 10, fontWeight: '700', color: colors.redDark }}>{t('ad.noPlus')}</Text></Pressable>
    } />
  );
  return (
    <Screen tabs="discover">
      <PeopleHead active="discover" />
      {body}
      <Btn kind="secondary" label={t('ad.next')} onPress={next} />
    </Screen>
  );
}
