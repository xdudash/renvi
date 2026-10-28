import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Screen, StateBlock, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { buy, loadOffers, manageSubscriptions, purchasesAvailable, restore } from '@/lib/purchases';
import { getPlanChoice } from '@/lib/planChoice';
import { useSession } from '@/lib/session';

// 80 · Состояние покупки / восстановление
export default function PurchaseState() {
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
    if (!offer) { setState('failed'); toast('Тариф пока недоступен в магазине'); return; }
    const r = await buy(offer);
    if (r === 'ok') { await waitForServer(); router.replace('/purchase-success'); return; }
    setState(r === 'cancelled' ? 'idle' : 'failed');
    if (r === 'cancelled') toast('Покупка отменена');
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
    toast(r === 'ok' ? 'Покупки проверены' : 'Не удалось восстановить покупки');
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
      <Title kicker="ПОКУПКА APP STORE" heading="Подписка обрабатывается" sub="Экран подтверждения Apple покажет финальную цену, период и условия автоматического продления." />
      {state === 'unavailable' ? (
        <StateBlock icon="" title="Покупка доступна в приложении" copy="Оформить подписку можно в приложении RENVI на iPhone или Android через App Store или Google Play." />
      ) : state === 'failed' ? (
        <StateBlock icon="↻" title="Покупка не завершена" copy="Деньги не списаны, пока покупка не подтверждена магазином. Попробуйте ещё раз." label="Повторить" onPress={runBuy} />
      ) : (
        <StateBlock icon="" title="Подтвердите в системном окне" copy="Покупка не завершена, пока вы не подтвердили её в App Store." label={state === 'busy' ? 'Ожидаем подтверждения…' : 'Открыть окно оплаты'} onPress={state === 'busy' ? () => {} : runBuy} />
      )}
      <Btn kind="ghost" label="Отменить и вернуться" onPress={() => router.replace('/plans')} />
      <Card tight>
        <Row label="Восстановить предыдущие покупки" onPress={runRestore} />
        <Row label="Управлять подпиской в Apple ID" onPress={() => manageSubscriptions().catch(() => toast('Откройте настройки подписок в Apple ID'))} />
      </Card>
    </Screen>
  );
}
