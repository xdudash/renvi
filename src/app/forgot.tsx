import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { BackLink, Btn, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validateEmail } from '@/lib/validate';

// 05 · Восстановление пароля
export default function Forgot() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const e = validateEmail(email);
    if (e) { setError(e); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/signin') });
    setBusy(false);
    if (err) { setError('Не удалось отправить письмо. Повторите попытку.'); return; }
    router.replace({ pathname: '/confirmation', params: { email: email.trim(), kind: 'reset' } });
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="АККАУНТ" heading="Восстановите доступ" sub="Войдите по почте и паролю." />
      <Field label="ЭЛЕКТРОННАЯ ПОЧТА" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12 }}>{error}</Text> : null}
      <Btn label="Отправить ссылку" onPress={submit} busy={busy} />
    </Screen>
  );
}
