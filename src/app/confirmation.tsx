import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

// 06 · Подтверждение аккаунта
export default function Confirmation() {
  const { t } = useLang();
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
    toast(error ? t('screens.confirmation.neUdalosOtpravitPismo') : t('screens.confirmation.pismoOtpravlenoEscheRaz'));
  };
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/signin')} />
      <StateBlock icon="✉" title={t('screens.confirmation.pismoOtpravleno')} copy={t('screens.confirmation.otkroytePismoOtRenvi')} label={busy ? t('screens.confirmation.otpravlyaem') : t('screens.confirmation.otpravitEscheRaz')} onPress={resend} />
      <Btn kind="ghost" label={t('screens.confirmation.vernutsyaKoVhodu')} onPress={() => router.replace('/signin')} />
    </Screen>
  );
}
