import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Screen, StateBlock, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { buy, loadOffers, manageSubscriptions, purchasesAvailable, restore, syncPurchases } from '@/lib/purchases';
import { getPlanChoice } from '@/lib/planChoice';
import { type Expectation, purchaseVerdict, serverProduct, serverTier } from '@/lib/billing';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// Server polling after the store said OK: the webhook usually lands within seconds.
const POLLS = 8;
const GAP_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type State = 'idle' | 'busy' | 'confirming' | 'pending' | 'scheduled' | 'failed' | 'unavailable';

// 80 · Состояние покупки / восстановление
export default function PurchaseState() {
  const { t } = useLang();
  const { action } = useLocalSearchParams<{ action?: 'buy' | 'restore' }>();
  const toast = useToast();
  const { refresh, session, tier, productId } = useSession();
  const [state, setState] = useState<State>(() =>
    action && !purchasesAvailable() ? 'unavailable' : action ? 'busy' : 'idle');
  const started = useRef(false);
  // What the last successful store purchase should turn into on the server.
  const expected = useRef<Expectation | null>(null);
  const uid = session?.user.id ?? null;

  // Success is shown only once the server plan matches the purchase (the webhook switches it, not the app).
  const confirmWithServer = async () => {
    const exp = expected.current;
    if (!exp || !uid) { setState('pending'); return; }
    setState('confirming');
    for (let i = 0; i < POLLS; i++) {
      const final = i === POLLS - 1;
      const sub = await api.subscription(uid).catch(() => null);
      const verdict = sub ? purchaseVerdict(exp, sub, Date.now(), final) : 'waiting';
      if (verdict === 'confirmed') { await refresh(); router.replace('/purchase-success'); return; }
      if (verdict === 'scheduled') { await refresh(); setState('scheduled'); return; }
      if (!final) await sleep(GAP_MS);
    }
    setState('pending');
  };

  const runBuy = async () => {
    if (!purchasesAvailable()) { setState('unavailable'); return; }
    setState('busy');
    await purchaseFlow();
  };
  // Store flow; state is already 'busy' when this starts.
  const purchaseFlow = async () => {
    const c = getPlanChoice();
    const offer = (await loadOffers().catch(() => [])).find((o) => o.tier === c.tier && o.period === c.period);
    if (!offer) { setState('failed'); toast(t('screens.purchaseState.unavailableOffer')); return; }
    // Plan before the purchase, fresh from the server (the session copy may be stale).
    const before = uid ? await api.subscription(uid).catch(() => null) : null;
    const now = Date.now();
    const previousTier = before ? serverTier(before, now) : tier;
    const previousProduct = before ? serverProduct(before, now) : productId;
    const r = await buy(offer, previousProduct);
    if (r.status === 'ok') {
      expected.current = { tier: c.tier, productId: r.productId, previousTier, previousProduct };
      await confirmWithServer();
      return;
    }
    setState(r.status === 'cancelled' ? 'idle' : 'failed');
    if (r.status === 'cancelled') toast(t('screens.purchaseState.cancelled'));
  };
  const runRestore = async () => {
    if (!purchasesAvailable()) { setState('unavailable'); return; }
    setState('busy');
    await restoreFlow();
  };
  const restoreFlow = async () => {
    const r = await restore();
    if (expected.current) {
      if (r !== 'ok') toast(t('screens.purchaseState.restoreFailed'));
      await confirmWithServer();
      return;
    }
    await refresh();
    setState('idle');
    toast(r === 'ok' ? t('screens.purchaseState.restoreOk') : t('screens.purchaseState.restoreFailed'));
  };
  // Re-sends the receipts to RevenueCat (which re-triggers the webhook), then checks the server again.
  const runSync = async () => {
    setState('confirming');
    if ((await syncPurchases()) !== 'ok') toast(t('screens.purchaseState.restoreFailed'));
    await confirmWithServer();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!purchasesAvailable()) return;
    if (action === 'buy') purchaseFlow();
    if (action === 'restore') restoreFlow();
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const block = () => {
    switch (state) {
      case 'unavailable':
        return <StateBlock icon="" title={t('screens.purchaseState.unavailableTitle')} copy={t('screens.purchaseState.unavailableCopy')} />;
      case 'failed':
        return <StateBlock icon="↻" title={t('screens.purchaseState.failedTitle')} copy={t('screens.purchaseState.failedCopy')} label={t('screens.purchaseState.retry')} onPress={runBuy} />;
      case 'confirming':
        return <StateBlock icon="" title={t('billing.confirmingTitle')} copy={t('billing.confirmingCopy')} label={t('screens.purchaseState.waiting')} onPress={() => {}} />;
      case 'pending':
        return (
          <StateBlock icon="↻" title={t('billing.pendingTitle')} copy={t('billing.pendingCopy')} label={t('billing.checkAgain')} onPress={confirmWithServer}
            secondary={<View style={{ alignSelf: 'stretch' }}>
              <Btn kind="ghost" label={t('billing.sync')} onPress={runSync} />
              <Btn kind="ghost" label={t('billing.restore')} onPress={runRestore} />
            </View>} />
        );
      case 'scheduled':
        return <StateBlock icon="✓" title={t('billing.scheduledTitle')} copy={t('billing.scheduledCopy')} label={t('billing.toPlans')} onPress={() => router.replace('/plans')} />;
      default:
        return <StateBlock icon="" title={t('screens.purchaseState.confirmTitle')} copy={t('screens.purchaseState.confirmCopy')} label={state === 'busy' ? t('screens.purchaseState.waiting') : t('screens.purchaseState.openPayment')} onPress={state === 'busy' ? () => {} : runBuy} />;
    }
  };

  return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <Title kicker={t('screens.purchaseState.kicker')} heading={t('screens.purchaseState.heading')} sub={t('screens.purchaseState.sub')} />
      {block()}
      <Btn kind="ghost" label={t('screens.purchaseState.cancelBack')} onPress={() => router.replace('/plans')} />
      <Card tight>
        <Row label={t('screens.purchaseState.restorePrevious')} onPress={runRestore} />
        <Row label={t('screens.purchaseState.manage')} onPress={() => manageSubscriptions().catch(() => toast(t('screens.purchaseState.openSettings')))} />
      </Card>
    </Screen>
  );
}
