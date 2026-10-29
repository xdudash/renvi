import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Field, LinkBtn, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validateEmail } from '@/lib/validate';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { isNetworkAuthError } from '@/lib/authErrors';

// 03 · Войти
export default function SignIn() {
  const { t } = useLang();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const e = validateEmail(email) ?? (password.length === 0 ? t('screens.signin.enterPassword') : null);
    if (e) { setError(e); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) { setError(isNetworkAuthError(err) ? t('lib.errors.offline') : err.message.includes('confirm') ? t('screens.signin.confirmEmail') : t('screens.signin.wrongCredentials')); return; }
    await refresh();
    router.replace('/');
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.signin.kicker')} heading={t('screens.signin.heading')} sub={t('screens.signin.sub')} />
      <Field label={t('screens.signin.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@example.com" />
      <Field label={t('screens.signin.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry placeholder={t('screens.signin.passwordPlaceholder')} autoComplete="current-password" />
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12 }}>{error}</Text> : null}
      <Btn label={t('screens.signin.submit')} onPress={submit} busy={busy} />
      <LinkBtn label={t('screens.signin.forgot')} onPress={() => router.push('/forgot')} />
    </Screen>
  );
}
