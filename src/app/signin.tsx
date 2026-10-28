import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Field, LinkBtn, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validateEmail } from '@/lib/validate';
import { useSession } from '@/lib/session';

// 03 · Войти
export default function SignIn() {
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const e = validateEmail(email) ?? (password.length === 0 ? 'Введите пароль' : null);
    if (e) { setError(e); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) { setError(err.message.includes('confirm') ? 'Подтвердите почту по ссылке из письма.' : 'Неверная почта или пароль.'); return; }
    await refresh();
    router.replace('/');
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="АККАУНТ" heading="С возвращением" sub="Войдите по почте и паролю." />
      <Field label="ЭЛЕКТРОННАЯ ПОЧТА" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@example.com" />
      <Field label="ПАРОЛЬ" value={password} onChangeText={setPassword} secureTextEntry placeholder="Не менее 8 символов" autoComplete="current-password" />
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12 }}>{error}</Text> : null}
      <Btn label="Войти" onPress={submit} busy={busy} />
      <LinkBtn label="Не помню пароль" onPress={() => router.push('/forgot')} />
    </Screen>
  );
}
