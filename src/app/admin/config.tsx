import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { AdminPage } from '@/components/AdminUI';
import { Btn, Card, Field, Loading, Tiny, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const KEYS: [string, string][] = [
  ['tier_limits', 'Лимиты тарифов (лайки в день и функции Free / Plus / Premium)'],
  ['prices_preliminary', 'Цены (справочно; итоговая цена — в App Store / Google Play)'],
  ['legal_urls', 'Ссылки на документы'],
  ['banned_words', 'Запрещённые слова (массив строк)'],
  ['referral', 'Реферальная программа (цель и дни Plus)'],
  ['launch_countries', 'Страны запуска'],
];

// Server configuration editable without a new app build.
export default function AdminConfig() {
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
      toast(error ? 'Ошибка сохранения' : 'Сохранено');
    } catch { toast('Некорректный JSON'); }
  };
  if (!values) return <AdminPage title="Тарифы и настройки"><Loading /></AdminPage>;
  return (
    <AdminPage title="Тарифы и настройки">
      {KEYS.map(([k, label]) => (
        <Card key={k}>
          <Text style={{ fontWeight: '700', fontSize: 13 }}>{label}</Text>
          <Tiny>{k}</Tiny>
          <Field value={values[k] ?? ''} onChangeText={(v) => setValues({ ...values, [k]: v })} multiline autoCapitalize="none" style={{ minHeight: 120, fontFamily: 'Courier', fontSize: 11, textAlignVertical: 'top' }} />
          <Btn label="Сохранить" onPress={() => save(k)} />
        </Card>
      ))}
    </AdminPage>
  );
}
