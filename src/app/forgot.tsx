import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { BackLink, Btn, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validateEmail } from '@/lib/validate';
import { useLang } from '@/lib/lang';

// 05 · Восстановление пароля
export default function Forgot() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const e = validateEmail(email);
    if (e) { setError(e); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/signin') });
    setBusy(false);
    if (err) { setError(t('screens.forgot.sendFailed')); return; }
    router.replace({ pathname: '/confirmation', params: { email: email.trim(), kind: 'reset' } });
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.forgot.kicker')} heading={t('screens.forgot.heading')} sub={t('screens.forgot.sub')} />
      <Field label={t('screens.forgot.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12 }}>{error}</Text> : null}
      <Btn label={t('screens.forgot.send')} onPress={submit} busy={busy} />
    </Screen>
  );
}
