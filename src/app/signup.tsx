import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, CheckRow, Field, Screen, Tiny, Title, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validateEmail, validatePassword } from '@/lib/validate';
import { captchaEnabled } from '@/lib/captcha';
import { pendingInvite } from '@/lib/referral';
import { setPendingSignup } from '@/lib/pendingSignup';
import { useLang } from '@/lib/lang';

// 04 · Создать аккаунт
export default function SignUp() {
  const { t } = useLang();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const e = validateEmail(email) ?? validatePassword(password) ?? (!adult ? t('screens.signup.podtverditeChtoVamIspolnil') : null);
    if (e) { setError(e); return; }
    if (captchaEnabled()) { setPendingSignup({ email: email.trim(), password }); router.push('/captcha'); return; }
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { invite_code: await pendingInvite() } },
    });
    setBusy(false);
    if (err) { setError(err.message.includes('registered') ? t('screens.signup.etotAdresUzheZaregistrirov') : t('screens.signup.neUdalosSozdatAkkaunt')); return; }
    if (!data.session) { router.replace({ pathname: '/confirmation', params: { email: email.trim() } }); return; }
    toast(t('screens.signup.akkauntSozdan'));
    router.replace('/ob-age');
  };

  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.signup.akkaunt')} heading={t('screens.signup.sozdayteAkkaunt')} sub={t('screens.signup.etoZaymetParuMinut')} />
      <Field label={t('screens.signup.elektronnayaPochta')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@example.com" />
      <Field label={t('screens.signup.parol')} value={password} onChangeText={setPassword} secureTextEntry placeholder={t('screens.signup.neMenee8Simvolov')} autoComplete="new-password" />
      <CheckRow left on={adult} onPress={() => setAdult(!adult)}><Text style={{ fontSize: 12 }}>{t('screens.signup.mneIspolnilos18Let')}</Text></CheckRow>
      <Tiny>{t('screens.signup.peredPublikatsieyAnketyVy')}</Tiny>
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12, marginTop: 8 }}>{error}</Text> : null}
      <Btn label={t('screens.signup.prodolzhit')} onPress={submit} busy={busy} />
      <Pressable onPress={() => router.push('/legal')} accessibilityRole="link">
        <Text style={{ fontSize: 10, color: '#706862', textAlign: 'center', marginVertical: 7 }}>
          {t('screens.signup.prodolzhayaVySoglashaetesS')} <Text style={{ textDecorationLine: 'underline' }}>{t('screens.signup.usloviyami')}</Text> {t('screens.signup.i')} <Text style={{ textDecorationLine: 'underline' }}>{t('screens.signup.politikoyPrivatnosti')}</Text>.
        </Text>
      </Pressable>
    </Screen>
  );
}
