import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Screen, StateBlock, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { buy, loadOffers, manageSubscriptions, purchasesAvailable, restore } from '@/lib/purchases';
import { getPlanChoice } from '@/lib/planChoice';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 80 · Состояние покупки / восстановление
export default function PurchaseState() {
  const { t } = useLang();
  const { action } = useLocalSearchParams<{ action?: 'buy' | 'restore' }>();
  const toast = useToast();
  const { refresh } = useSession();
  const [state, setState] = useState<'idle' | 'busy' | 'failed' | 'unavailable'>(() =>
    action && !purchasesAvailable() ? 'unavailable' : action ? 'busy' : 'idle');
  const started = useRef(false);

  // The server switches the plan after the store webhook; poll the session briefly.
  const waitForServer = async () => {
    for (let i = 0; i < 6; i++) { await refresh(); await new Promise((r) => setTimeout(r, 1500)); }
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
    const r = await buy(offer);
    if (r === 'ok') { await waitForServer(); router.replace('/purchase-success'); return; }
    setState(r === 'cancelled' ? 'idle' : 'failed');
    if (r === 'cancelled') toast(t('screens.purchaseState.cancelled'));
  };
  const runRestore = async () => {
    if (!purchasesAvailable()) { setState('unavailable'); return; }
    setState('busy');
    await restoreFlow();
  };
  const restoreFlow = async () => {
    const r = await restore();
    await refresh();
    setState('idle');
    toast(r === 'ok' ? t('screens.purchaseState.restoreOk') : t('screens.purchaseState.restoreFailed'));
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!purchasesAvailable()) return;
    if (action === 'buy') purchaseFlow();
    if (action === 'restore') restoreFlow();
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <BackLink onPress={() => router.replace('/plans')} />
      <Title kicker={t('screens.purchaseState.kicker')} heading={t('screens.purchaseState.heading')} sub={t('screens.purchaseState.sub')} />
      {state === 'unavailable' ? (
        <StateBlock icon="" title={t('screens.purchaseState.unavailableTitle')} copy={t('screens.purchaseState.unavailableCopy')} />
      ) : state === 'failed' ? (
        <StateBlock icon="↻" title={t('screens.purchaseState.failedTitle')} copy={t('screens.purchaseState.failedCopy')} label={t('screens.purchaseState.retry')} onPress={runBuy} />
      ) : (
        <StateBlock icon="" title={t('screens.purchaseState.confirmTitle')} copy={t('screens.purchaseState.confirmCopy')} label={state === 'busy' ? t('screens.purchaseState.waiting') : t('screens.purchaseState.openPayment')} onPress={state === 'busy' ? () => {} : runBuy} />
      )}
      <Btn kind="ghost" label={t('screens.purchaseState.cancelBack')} onPress={() => router.replace('/plans')} />
      <Card tight>
        <Row label={t('screens.purchaseState.restorePrevious')} onPress={runRestore} />
        <Row label={t('screens.purchaseState.manage')} onPress={() => manageSubscriptions().catch(() => toast(t('screens.purchaseState.openSettings')))} />
      </Card>
    </Screen>
  );
}
