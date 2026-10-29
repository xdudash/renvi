import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Field, Screen, StateBlock, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { confirmationRedirectUrl } from '@/lib/confirmationAuth';
import { validateEmail } from '@/lib/validate';
import { useSession } from '@/lib/session';
import { recoveryRedirectUrl } from '@/lib/recoveryAuth';
import { resendWaitSeconds } from '@/lib/authRate';

// 06 · Подтверждение аккаунта
export default function Confirmation() {
  const { t } = useLang();
  const { email, kind } = useLocalSearchParams<{ email?: string; kind?: string }>();
  const toast = useToast();
  const {session}=useSession();
  const [address,setAddress]=useState(email??session?.user.email??'');
  const [busy, setBusy] = useState(false);
  // Auth allows one e-mail per address per interval (hosted default 60 s). When it refuses, show a countdown
  // instead of a generic failure; the seconds come from the server's answer.
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waitUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waitUntil]);
  const left = Math.max(0, Math.ceil((waitUntil - now) / 1000));
  const resend = async () => {
    if (left > 0 || busy) return;
    const invalid=validateEmail(address); if(invalid){toast(invalid);return;}
    setBusy(true);
    const { error } = kind === 'reset'
      ? await supabase.auth.resetPasswordForEmail(address.trim(), { redirectTo: recoveryRedirectUrl() })
      : await supabase.auth.resend({ type: 'signup', email:address.trim(), options:{emailRedirectTo:confirmationRedirectUrl()} });
    setBusy(false);
    if (error) {
      const secs = resendWaitSeconds(error);
      if (secs) { setNow(Date.now()); setWaitUntil(Date.now() + secs * 1000); toast(t('screens.confirmation.waitBeforeResend', { n: secs })); return; }
      toast(t('screens.confirmation.neUdalosOtpravitPismo'));
      return;
    }
    toast(t('screens.confirmation.pismoOtpravlenoEscheRaz'));
  };
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/signin')} />
      <Field label={t('identity.email')} value={address} onChangeText={setAddress} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <StateBlock icon="✉" title={t('screens.confirmation.pismoOtpravleno')} copy={t('screens.confirmation.otkroytePismoOtRenvi')} label={busy ? t('screens.confirmation.otpravlyaem') : left > 0 ? t('screens.confirmation.resendIn', { n: left }) : t('screens.confirmation.otpravitEscheRaz')} onPress={resend} />
      <Btn kind="ghost" label={t('screens.confirmation.vernutsyaKoVhodu')} onPress={() => router.replace('/signin')} />
    </Screen>
  );
}
