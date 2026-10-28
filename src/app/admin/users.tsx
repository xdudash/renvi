import { useState } from 'react';
import { View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Field, Loading, Pill, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { daysFromNowIso } from '@/lib/time';
import { useLang } from '@/lib/lang';

type U = { id: string; email: string; display_name: string | null; age: number | null; country: string; city: string | null; verification_status: string; onboarding_done: boolean; suspended_until: string | null; tier: string; created_at: string; reports: number };

export default function AdminUsers() {
  const { t } = useLang();
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
    toast(error ? t('screens.adminUsers.oshibka') : t('screens.adminUsers.sohraneno')); reload();
  };
  return (
    <AdminPage title={t('screens.adminUsers.polzovateli')}>
      <Field value={q} onChangeText={setQ} placeholder={t('screens.adminUsers.imyaIliPochta')} accessibilityLabel={t('screens.adminUsers.poiskPolzovateley')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[null, 'SK', 'CZ'].map((c) => <Pill key={c ?? 'all'} label={c ?? t('screens.adminUsers.vseStrany')} active={country === c} onPress={() => setCountry(c)} />)}
        <Pill label={t('screens.adminUsers.novye')} active={sort === 'new'} onPress={() => setSort('new')} />
        <Pill label={t('screens.adminUsers.poZhalobam')} active={sort === 'reports'} onPress={() => setSort('reports')} />
      </View>
      {loading ? <Loading /> : (
        <Tbl head={[t('screens.adminUsers.pochta'), t('screens.adminUsers.imya'), t('screens.adminUsers.stranaGorod'), t('screens.adminUsers.anketa'), t('screens.adminUsers.proverka'), t('screens.adminUsers.tarif'), t('screens.adminUsers.zhaloby'), t('screens.adminUsers.ogranichenie'), t('screens.adminUsers.deystviya')]} rows={rows.map((u) => [
          u.email, `${u.display_name ?? '—'}${u.age ? `, ${u.age}` : ''}`, `${u.country} · ${u.city ?? '—'}`, u.onboarding_done ? t('screens.adminUsers.opublikovana') : t('screens.adminUsers.chernovik'),
          u.verification_status, u.tier, u.reports, u.suspended_until ?? '—',
          <View key="a"><Act label={t('screens.adminUsers.predupredit')} onPress={() => act(u, 'warning')} /><Act label={t('screens.adminUsers.pauza7Dn')} onPress={() => act(u, 'suspension')} /><Act label={t('screens.adminUsers.blok')} tone="red" onPress={() => act(u, 'ban')} />{u.suspended_until ? <Act label={t('screens.adminUsers.snyat')} tone="green" onPress={() => act(u, 'lift')} /> : null}</View>,
        ])} />
      )}
    </AdminPage>
  );
}
