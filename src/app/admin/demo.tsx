import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { Act, AdminPage, Busy, ErrorNote, Section } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { AdminError } from '@/lib/adminApi';
import { useLang } from '@/lib/lang';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

type Account = { id: string; email: string; display_name: string | null };
const text = { color: colors.ink, fontSize: 14 } as const;
const hint = { color: colors.sub, fontSize: 12 } as const;

async function loadAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.rpc('admin_demo_accounts');
  if (error) throw new AdminError(error.message, error.code);
  return data ?? [];
}
function AccountAccess({ account }: { account: Account }) {
  const { t } = useLang();
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; auditPending: boolean } | null>(null);
  const reset = async () => {
    if (busy) return;
    setMessage(''); setCredentials(null); setCopied(false);
    // New runtime entropy for each request; generated credentials never enter storage or logs.
    let password: string;
    try { password = custom || `Renvi-${Crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`; }
    catch { setMessage(t('adm.demo.failed')); return; }
    let bytes = 0;
    try { bytes = encodeURIComponent(password).replace(/%[\dA-F]{2}|./gi, 'x').length; } catch { /* invalid UTF-16 */ }
    if ([...password].length < 8 || !bytes || bytes > 72) { setMessage(t('adm.demo.invalid')); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('demo-access', { body: { userId: account.id, password } });
      if (error || data?.status !== 200 || data.email !== account.email) {
        setMessage(t('adm.demo.failed')); return;
      }
      setCredentials({ email: data.email, password, auditPending: data.auditPending === true });
      setCustom('');
    } catch { setMessage(t('adm.demo.failed')); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!credentials) return;
    try { await Clipboard.setStringAsync(`${credentials.email}\n${credentials.password}`); setCopied(true); }
    catch { setMessage(t('adm.demo.copyFailed')); }
  };
  return (
    <Section title={account.display_name || t('adm.demo.unnamed')}>
      <Text style={text} selectable>{account.email}</Text>
      <Text style={[hint, { marginVertical: 8 }]}>{t('adm.demo.hint')}</Text>
      <TextInput value={custom} onChangeText={setCustom} secureTextEntry editable={!busy}
        accessibilityLabel={t('adm.demo.custom')} placeholder={t('adm.demo.custom')} autoCapitalize="none" autoCorrect={false}
        style={{ color: colors.ink, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, marginBottom: 10 }} />
      <Act label={busy ? t('adm.dialog.working') : t('adm.demo.reset')} onPress={reset} disabled={busy} />
      {message ? <Text accessibilityRole="alert" style={{ color: colors.redDark, marginTop: 10 }}>{message}</Text> : null}
      {credentials ? (
        <View style={{ marginTop: 14, gap: 10 }} accessibilityLiveRegion="polite">
          <Text style={text}>{t('adm.demo.success')}</Text>
          <Text style={text} selectable>{credentials.email}{'\n'}{credentials.password}</Text>
          {credentials.auditPending ? <Text style={hint}>{t('adm.demo.pending')}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Act label={copied ? t('adm.demo.copied') : t('adm.demo.copy')} onPress={copy} />
            <Act label={t('adm.demo.hide')} onPress={() => { setCredentials(null); setCopied(false); }} />
          </View>
        </View>
      ) : null}
    </Section>
  );
}
export default function AdminDemoAccess() {
  const { t } = useLang();
  const accounts = useAsync(loadAccounts, []);
  return (
    <AdminPage title={t('adm.demo.title')} sub={t('adm.demo.sub')} right={<Act label={t('adm.common.refresh')} onPress={accounts.reload} />}>
      <Text style={[hint, { marginBottom: 16 }]}>{t('adm.demo.note')}</Text>
      {accounts.error ? <ErrorNote message={t('adm.demo.failed')} onRetry={accounts.reload} /> : null}
      {accounts.loading ? <Busy /> : null}
      {accounts.data?.length === 0 ? <Text style={text}>{t('adm.demo.empty')}</Text> : null}
      {accounts.data?.map((account) => <AccountAccess key={account.id} account={account} />)}
    </AdminPage>
  );
}
