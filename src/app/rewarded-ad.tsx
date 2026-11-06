import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdCard } from '@/components/AdCard';
import { Btn, Card, ErrorBlock, Loading, Screen, StateBlock, Tiny, useToast } from '@/components/ui';
import { api, type AdReward } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { setTier, useMyTier } from '@/lib/tier';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

type Phase = { k: 'loading' } | { k: 'ready'; reward: AdReward; endsAt: number } | { k: 'none' } | { k: 'empty' } | { k: 'error' };

// rewarded-ad · a partner card for N seconds, then +5 sparks. The server picks the ad, times the view and gives the sparks once.
export default function RewardedAd() {
  const { t } = useLang();
  const toast = useToast();
  const { uid } = useMyTier();
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    api.adRewardStart().then(
      (reward) => { setNow(Date.now()); setPhase({ k: 'ready', reward, endsAt: Date.now() + reward.seconds * 1000 }); },
      (e) => {
        const code = toAppError(e).code;
        if (code === 'P0002') setPhase({ k: 'empty' });
        else if (code === 'P0003' || code === 'P0010') setPhase({ k: 'none' });
        else setPhase({ k: 'error' });
      },
    );
  }, [attempt]);

  useEffect(() => {
    if (phase.k !== 'ready') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  if (phase.k === 'loading') return <Screen><Loading label={t('ad.loading')} /></Screen>;
  if (phase.k === 'error') return <Screen><ErrorBlock message={t('plans.err.generic')} onRetry={() => { setPhase({ k: 'loading' }); setAttempt((n) => n + 1); }} /></Screen>;
  if (phase.k === 'empty') return <Screen><StateBlock icon="▷" title={t('ad.none')} copy={t('ad.noneCopy')} label={t('common.back')} onPress={() => router.back()} /></Screen>;
  if (phase.k === 'none') return <Screen><StateBlock icon="▷" title={t('limit.noAds')} copy="" label={t('common.back')} onPress={() => router.back()} /></Screen>;

  const { reward, endsAt } = phase;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const claim = async () => {
    if (busy || left > 0) return;
    setBusy(true);
    try {
      const tier = await api.adRewardClaim(reward.reward_id);
      if (uid) setTier(uid, tier);
      toast(t('ad.claimed', { n: reward.sparks }));
      router.back();
    } catch (e) {
      toast(toAppError(e).code === 'P0006' ? t('ad.wait', { n: 1 }) : t('plans.err.generic'));
    } finally { setBusy(false); }
  };
  return (
    <Screen>
      <AdCard ad={reward.ad} label={t('ad.label')} aside={<Text style={s.count}>{t('ad.sec', { n: left })}</Text>} />
      <Card tight>
        <View style={{ gap: 3 }}>
          <Text style={s.rewardH}>{t('ad.reward', { n: reward.sparks })}</Text>
          <Tiny>{t('ad.rewardSub')}</Tiny>
        </View>
      </Card>
      <Btn label={left > 0 ? t('ad.wait', { n: left }) : t('ad.claim', { n: reward.sparks })} disabled={left > 0} busy={busy} onPress={claim} />
      <Btn kind="ghost" label={t('ad.closeNo')} onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  count: { fontSize: 11, fontWeight: '800', color: colors.redDark },
  rewardH: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
});
