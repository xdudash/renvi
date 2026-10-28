import { useState } from 'react';
import { View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Field, Loading, Pill, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { daysFromNowIso } from '@/lib/time';

type U = { id: string; email: string; display_name: string | null; age: number | null; country: string; city: string | null; verification_status: string; onboarding_done: boolean; suspended_until: string | null; tier: string; created_at: string; reports: number };

export default function AdminUsers() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [sort, setSort] = useState<'new' | 'reports'>('new');
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.rpc('admin_users', { p_query: q.trim() || null, p_country: country });
    if (error) throw error;
    return d as U[];
  }, [q, country]);
  const rows = [...(data ?? [])].sort((a, b) => (sort === 'reports' ? b.reports - a.reports : b.created_at.localeCompare(a.created_at)));
  const act = async (u: U, kind: 'warning' | 'suspension' | 'ban' | 'lift') => {
    const until = kind === 'suspension' ? daysFromNowIso(7) : null;
    const { error } = await supabase.rpc('admin_sanction', { p_user: u.id, p_kind: kind, p_reason: 'admin', p_until: until });
    toast(error ? 'Ошибка' : 'Сохранено'); reload();
  };
  return (
    <AdminPage title="Пользователи">
      <Field value={q} onChangeText={setQ} placeholder="Имя или почта" accessibilityLabel="Поиск пользователей" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[null, 'SK', 'CZ'].map((c) => <Pill key={c ?? 'all'} label={c ?? 'Все страны'} active={country === c} onPress={() => setCountry(c)} />)}
        <Pill label="Новые" active={sort === 'new'} onPress={() => setSort('new')} />
        <Pill label="По жалобам" active={sort === 'reports'} onPress={() => setSort('reports')} />
      </View>
      {loading ? <Loading /> : (
        <Tbl head={['Почта', 'Имя', 'Страна · город', 'Анкета', 'Проверка', 'Тариф', 'Жалобы', 'Ограничение', 'Действия']} rows={rows.map((u) => [
          u.email, `${u.display_name ?? '—'}${u.age ? `, ${u.age}` : ''}`, `${u.country} · ${u.city ?? '—'}`, u.onboarding_done ? 'опубликована' : 'черновик',
          u.verification_status, u.tier, u.reports, u.suspended_until ?? '—',
          <View key="a"><Act label="Предупредить" onPress={() => act(u, 'warning')} /><Act label="Пауза 7 дн." onPress={() => act(u, 'suspension')} /><Act label="Блок" tone="red" onPress={() => act(u, 'ban')} />{u.suspended_until ? <Act label="Снять" tone="green" onPress={() => act(u, 'lift')} /> : null}</View>,
        ])} />
      )}
    </AdminPage>
  );
}
