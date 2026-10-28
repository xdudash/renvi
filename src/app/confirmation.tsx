import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// 06 · Подтверждение аккаунта
export default function Confirmation() {
  const { email, kind } = useLocalSearchParams<{ email?: string; kind?: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    if (!email) { router.replace('/signin'); return; }
    setBusy(true);
    const { error } = kind === 'reset'
      ? await supabase.auth.resetPasswordForEmail(email)
      : await supabase.auth.resend({ type: 'signup', email });
    setBusy(false);
    toast(error ? 'Не удалось отправить письмо' : 'Письмо отправлено ещё раз');
  };
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/signin')} />
      <StateBlock icon="✉" title="Письмо отправлено" copy="Откройте письмо от RENVI. Если его нет, проверьте папку «Спам» или запросите новое." label={busy ? 'Отправляем…' : 'Отправить ещё раз'} onPress={resend} />
      <Btn kind="ghost" label="Вернуться ко входу" onPress={() => router.replace('/signin')} />
    </Screen>
  );
}
