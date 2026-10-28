import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { AdminPage } from '@/components/AdminUI';
import { Btn, Card, Field, Loading, Tiny, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

const KEYS = [
  ['tier_limits', 'admin.config.tierLimits'],
  ['prices_preliminary', 'admin.config.prices'],
  ['legal_urls', 'admin.config.legalUrls'],
  ['banned_words', 'admin.config.bannedWords'],
  ['referral', 'admin.config.referral'],
  ['launch_countries', 'admin.config.launchCountries'],
] as const;

// Server configuration editable without a new app build.
export default function AdminConfig() {
  const { t } = useLang();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    supabase.from('app_config').select('key, value').then(({ data }) => {
      const m: Record<string, string> = {};
      for (const r of data ?? []) m[r.key] = JSON.stringify(r.value, null, 2);
      setValues(m);
    });
  }, []);
  const save = async (key: string) => {
    try {
      const parsed = JSON.parse(values?.[key] ?? 'null');
      const { error } = await supabase.rpc('admin_set_config', { p_key: key, p_value: parsed });
      toast(error ? t('admin.config.saveError') : t('admin.config.saved'));
    } catch { toast(t('admin.config.badJson')); }
  };
  if (!values) return <AdminPage title={t('admin.config.title')}><Loading /></AdminPage>;
  return (
    <AdminPage title={t('admin.config.title')}>
      {KEYS.map(([k, label]) => (
        <Card key={k}>
          <Text style={{ fontWeight: '700', fontSize: 13 }}>{t(label)}</Text>
          <Tiny>{k}</Tiny>
          <Field value={values[k] ?? ''} onChangeText={(v) => setValues({ ...values, [k]: v })} multiline autoCapitalize="none" style={{ minHeight: 120, fontFamily: 'Courier', fontSize: 11, textAlignVertical: 'top' }} />
          <Btn label={t('admin.config.save')} onPress={() => save(k)} />
        </Card>
      ))}
    </AdminPage>
  );
}
