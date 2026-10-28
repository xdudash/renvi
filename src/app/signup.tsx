import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, CheckRow, Field, Screen, Tiny, Title, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validateEmail, validatePassword } from '@/lib/validate';
import { captchaEnabled } from '@/lib/captcha';
import { pendingInvite } from '@/lib/referral';
import { setPendingSignup } from '@/lib/pendingSignup';

// 04 · Создать аккаунт
export default function SignUp() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const e = validateEmail(email) ?? validatePassword(password) ?? (!adult ? 'Подтвердите, что вам исполнилось 18 лет' : null);
    if (e) { setError(e); return; }
    if (captchaEnabled()) { setPendingSignup({ email: email.trim(), password }); router.push('/captcha'); return; }
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { invite_code: await pendingInvite() } },
    });
    setBusy(false);
    if (err) { setError(err.message.includes('registered') ? 'Этот адрес уже зарегистрирован. Попробуйте войти.' : 'Не удалось создать аккаунт. Повторите попытку.'); return; }
    if (!data.session) { router.replace({ pathname: '/confirmation', params: { email: email.trim() } }); return; }
    toast('Аккаунт создан');
    router.replace('/ob-age');
  };

  return (
    <Screen>
      <BackLink />
      <Title kicker="АККАУНТ" heading="Создайте аккаунт" sub="Это займёт пару минут. Профиль можно будет заполнить постепенно." />
      <Field label="ЭЛЕКТРОННАЯ ПОЧТА" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@example.com" />
      <Field label="ПАРОЛЬ" value={password} onChangeText={setPassword} secureTextEntry placeholder="Не менее 8 символов" autoComplete="new-password" />
      <CheckRow left on={adult} onPress={() => setAdult(!adult)}><Text style={{ fontSize: 12 }}>Мне исполнилось 18 лет</Text></CheckRow>
      <Tiny>Перед публикацией анкеты вы отдельно подтвердите Условия и обработку чувствительных предпочтений.</Tiny>
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12, marginTop: 8 }}>{error}</Text> : null}
      <Btn label="Продолжить" onPress={submit} busy={busy} />
      <Pressable onPress={() => router.push('/legal')} accessibilityRole="link">
        <Text style={{ fontSize: 10, color: '#706862', textAlign: 'center', marginVertical: 7 }}>
          Продолжая, вы соглашаетесь с <Text style={{ textDecorationLine: 'underline' }}>Условиями</Text> и <Text style={{ textDecorationLine: 'underline' }}>Политикой приватности</Text>.
        </Text>
      </Pressable>
    </Screen>
  );
}
