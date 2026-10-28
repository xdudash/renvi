import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';

// 53 · Завершить совпадение
export default function Unmatch() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const end = async (block: boolean) => {
    setBusy(true);
    try {
      const ctx = block ? await api.matchContext(match) : null;
      await api.endMatch(match);
      if (block && ctx) { await api.block(ctx.partner.id); router.replace('/blocked'); toast(t('screens.unmatch.blocked')); return; }
      toast(t('screens.unmatch.ended'));
      router.replace('/chats');
    } catch { toast(t('screens.unmatch.failed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.unmatch.kicker')} heading={t('screens.unmatch.heading')} sub={t('screens.unmatch.sub')} />
      <Btn kind="warn" label={t('screens.unmatch.end')} busy={busy} onPress={() => end(false)} />
      <Btn kind="ghost" label={t('screens.unmatch.block')} disabled={busy} onPress={() => end(true)} />
      <Btn kind="tertiary" label={t('screens.unmatch.keep')} onPress={() => router.back()} />
    </Screen>
  );
}
