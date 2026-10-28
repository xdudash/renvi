import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';
import { HCAPTCHA_SITE_KEY } from '@/lib/captcha';
import { supabase } from '@/lib/supabase';
import { pendingInvite } from '@/lib/referral';
import { getPendingSignup, setPendingSignup } from '@/lib/pendingSignup';

const html = (key: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://js.hcaptcha.com/1/api.js" async defer></script></head>
<body style="margin:0;display:flex;justify-content:center;background:#FDFCF9">
<div class="h-captcha" data-sitekey="${key}" data-callback="done"></div>
<script>function done(t){window.ReactNativeWebView.postMessage(t)}</script></body></html>`;

// 07 · CAPTCHA / защита
export default function Captcha() {
  const creds = getPendingSignup();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!creds) { router.replace('/signup'); return; }
    if (!token) { setError('Подтвердите, что вы не робот'); return; }
    setBusy(true);
    const { email, password } = creds;
    const { data, error: err } = await supabase.auth.signUp({
      email, password, options: { captchaToken: token, data: { invite_code: await pendingInvite() } },
    });
    setBusy(false);
    if (err) { setError('Проверка не прошла. Попробуйте ещё раз.'); return; }
    setPendingSignup(null);
    router.replace(data.session ? '/ob-age' : { pathname: '/confirmation', params: { email } });
  };
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/signup')} />
      <Title kicker="ЗАЩИТА АККАУНТА" heading="Проверим, что это вы" sub="Защита от автоматических регистраций." />
      <Card style={{ marginTop: 30, height: 100, padding: 0, overflow: 'hidden' }}>
        {HCAPTCHA_SITE_KEY ? (
          <WebView originWhitelist={['*']} source={{ html: html(HCAPTCHA_SITE_KEY), baseUrl: 'https://renvi.app' }} onMessage={(e) => setToken(e.nativeEvent.data)} />
        ) : (
          <View style={{ padding: 15 }}><Text style={{ fontSize: 12 }}>Защита регистрации не настроена.</Text></View>
        )}
      </Card>
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12 }}>{error}</Text> : null}
      <Btn label="Продолжить" onPress={submit} busy={busy} />
      <Btn kind="ghost" label="Проблема с проверкой?" onPress={() => router.push('/support-help')} />
    </Screen>
  );
}
