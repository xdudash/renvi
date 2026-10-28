import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';

// 53 · Завершить совпадение
export default function Unmatch() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const end = async (block: boolean) => {
    setBusy(true);
    try {
      const ctx = block ? await api.matchContext(match) : null;
      await api.endMatch(match);
      if (block && ctx) { await api.block(ctx.partner.id); router.replace('/blocked'); toast('Профиль заблокирован'); return; }
      toast('Совпадение завершено');
      router.replace('/chats');
    } catch { toast('Не удалось завершить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ЗАВЕРШИТЬ ДИАЛОГ?" heading="Вы больше не будете совпадать" sub="Это действие уберёт диалог у обоих и не отправит уведомление. Вы также можете заблокировать профиль." />
      <Btn kind="warn" label="Завершить совпадение" busy={busy} onPress={() => end(false)} />
      <Btn kind="ghost" label="Заблокировать профиль" disabled={busy} onPress={() => end(true)} />
      <Btn kind="tertiary" label="Оставить как есть" onPress={() => router.back()} />
    </Screen>
  );
}
