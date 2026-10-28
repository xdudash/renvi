import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Btn, Field, Loading, Screen, StateBlock, Title, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/validate';
import { establishRecoverySession } from '@/lib/recoveryAuth';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// Password recovery callback: renvi://reset-password (native) or /reset-password (web). The e-mail link carries a
// code / token that is exchanged for a session here, then the user picks a new password.
export default function ResetPassword() {
  const { t } = useLang();
  const toast = useToast();
  const { refresh } = useSession();
  const linkUrl = Linking.useLinkingURL();
  const [phase, setPhase] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let url: string | null = linkUrl;
      if (!url && Platform.OS === 'web' && typeof window !== 'undefined') url = window.location.href;
      if (!url) url = await Linking.getInitialURL().catch(() => null);
      let ok = false;
      try { ok = await establishRecoverySession(url); } catch { ok = false; }
      if (!alive) return;
      if (ok && Platform.OS === 'web' && typeof window !== 'undefined') {
        // Do not leave the one-time credentials in the address bar / history.
        window.history.replaceState(null, '', window.location.pathname);
      }
      setPhase(ok ? 'ready' : 'invalid');
    })();
    return () => { alive = false; };
  }, [linkUrl]);

  const submit = async () => {
    const e = validatePassword(password) ?? (password !== confirm ? t('client.reset.mismatch') : null);
    if (e) { setError(e); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setBusy(false); setError(t('client.reset.saveFailed')); return; }
    await refresh();
    setBusy(false);
    toast(t('client.reset.saved'));
    router.replace('/');
  };

  if (phase === 'checking') return <Screen><Loading label={t('client.reset.checking')} /></Screen>;
  if (phase === 'invalid') {
    return (
      <Screen>
        <StateBlock icon="⌁" title={t('client.reset.invalidTitle')} copy={t('client.reset.invalidCopy')} label={t('client.reset.requestNew')} onPress={() => router.replace('/forgot')} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Title kicker={t('client.reset.kicker')} heading={t('client.reset.heading')} sub={t('client.reset.sub')} />
      <Field label={t('client.reset.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" autoCapitalize="none" />
      <Field label={t('client.reset.confirmLabel')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" autoCapitalize="none" />
      {error ? <Text accessibilityRole="alert" style={{ color: '#a42623', fontSize: 12 }}>{error}</Text> : null}
      <Btn label={t('client.reset.save')} onPress={submit} busy={busy} />
    </Screen>
  );
}
