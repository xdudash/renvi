import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Field, Screen, StateBlock, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { confirmationRedirectUrl } from '@/lib/confirmationAuth';
import { validateEmail } from '@/lib/validate';
import { useSession } from '@/lib/session';
import { recoveryRedirectUrl } from '@/lib/recoveryAuth';

// 06 · Подтверждение аккаунта
export default function Confirmation() {
  const { t } = useLang();
  const { email, kind } = useLocalSearchParams<{ email?: string; kind?: string }>();
  const toast = useToast();
  const {session}=useSession();
  const [address,setAddress]=useState(email??session?.user.email??'');
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    const invalid=validateEmail(address); if(invalid){toast(invalid);return;}
    setBusy(true);
    const { error } = kind === 'reset'
      ? await supabase.auth.resetPasswordForEmail(address.trim(), { redirectTo: recoveryRedirectUrl() })
      : await supabase.auth.resend({ type: 'signup', email:address.trim(), options:{emailRedirectTo:confirmationRedirectUrl()} });
    setBusy(false);
    toast(error ? t('screens.confirmation.neUdalosOtpravitPismo') : t('screens.confirmation.pismoOtpravlenoEscheRaz'));
  };
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/signin')} />
      <Field label={t('identity.email')} value={address} onChangeText={setAddress} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <StateBlock icon="✉" title={t('screens.confirmation.pismoOtpravleno')} copy={t('screens.confirmation.otkroytePismoOtRenvi')} label={busy ? t('screens.confirmation.otpravlyaem') : t('screens.confirmation.otpravitEscheRaz')} onPress={resend} />
      <Btn kind="ghost" label={t('screens.confirmation.vernutsyaKoVhodu')} onPress={() => router.replace('/signin')} />
    </Screen>
  );
}
