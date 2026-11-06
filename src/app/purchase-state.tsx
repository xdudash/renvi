import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Eyebrow, Lede, Loading, Screen, StateBlock, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { buyPlus, initPurchases, plusOffers, restorePlus, syncPlus } from '@/lib/purchases';
import { refreshTier, useMyTier } from '@/lib/tier';
import { useLang } from '@/lib/lang';

type Phase = 'idle' | 'store' | 'server' | 'error' | 'delayed';

// purchase-state · the App Store sheet is open (buy) or purchases are being restored; then the server confirms.
export default function PurchaseState() {
  const { t } = useLang();
  const toast = useToast();
  const { mode, period } = useLocalSearchParams<{ mode?: string; period?: string }>();
  const { uid } = useMyTier();
  const [phase, setPhase] = useState<Phase>(mode === 'buy' || mode === 'restore' ? 'store' : 'idle');
  const [attempt, setAttempt] = useState(0);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || (mode !== 'buy' && mode !== 'restore')) return;
    const key = `${uid}:${mode}:${period}:${attempt}`;
    if (started.current === key) return;
    started.current = key;
    (async () => {
      await initPurchases(uid).catch(() => {});
      let paid = false;
      if (mode === 'buy') {
        const offer = (await plusOffers())?.find((o) => o.period === period);
        if (!offer) { setPhase('error'); return; }
        const r = await buyPlus(offer);
        if (r === 'cancelled') { router.back(); return; }
        if (r === 'error') { setPhase('error'); return; }
        paid = true;
      } else {
        const r = await restorePlus();
        if (r === 'error') { setPhase('error'); return; }
        if (r === 'none') { toast(t('purchase.noneFound')); router.back(); return; }
        paid = true;
      }
      if (!paid) return;
      setPhase('server');
      const plus = await syncPlus(4);
      if (plus) { await refreshTier(uid); router.replace('/purchase-success'); } else setPhase('delayed');
    })();
  }, [uid, mode, period, attempt, t, toast]);

  const links = (
    <Card tight>
      <Row label={t('purchase.restore')} onPress={() => { setPhase('store'); setAttempt((n) => n + 1); router.replace({ pathname: '/purchase-state', params: { mode: 'restore' } }); }} />
      <Row label={t('purchase.manage')} onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {})} />
    </Card>
  );

  if (phase === 'error') return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <StateBlock icon="!" title={t('purchase.err')} copy={t('purchase.errCopy')} label={t('purchase.retry')} onPress={() => { started.current = null; setPhase('store'); setAttempt((n) => n + 1); }} />
      {links}
    </Screen>
  );
  if (phase === 'delayed') return (
    <Screen>
      <BackLink onPress={() => router.replace('/me')} />
      <StateBlock icon="…" title={t('purchase.h')} copy={t('purchase.delayed')} label={t('purchase.ok.back')} onPress={() => router.replace('/me')} />
    </Screen>
  );
  if (phase === 'idle') return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <Title kicker={t('purchase.kicker')} heading={t('purchase.restore')} sub={t('purchase.sub')} />
      {links}
      <Btn kind="ghost" label={t('purchase.cancel')} onPress={() => router.replace('/plans')} />
    </Screen>
  );
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <Title kicker={t('purchase.kicker')} heading={t('purchase.h')} sub={t('purchase.sub')} />
      {phase === 'server' ? (
        <Card><Eyebrow>{t('purchase.kicker')}</Eyebrow><Lede>{t('purchase.checking')}</Lede><Loading /></Card>
      ) : (
        <StateBlock icon="" title={t('purchase.confirm')} copy={t('purchase.confirmCopy')} />
      )}
      {phase === 'store' ? <Btn kind="ghost" label={t('purchase.cancel')} onPress={() => router.replace('/plans')} /> : null}
    </Screen>
  );
}
