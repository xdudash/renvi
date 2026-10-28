import { View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';

type Rf = { invited_user: string; code: string; status: string; created_at: string; owner_name: string | null };

export default function AdminReferrals() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.rpc('admin_referrals');
    if (error) throw error;
    return d as Rf[];
  }, []);
  const decide = async (r: Rf, approve: boolean) => {
    const { error } = await supabase.rpc('admin_decide_referral', { p_invited: r.invited_user, p_approve: approve });
    toast(error ? 'Ошибка' : approve ? 'Награда начислена' : 'Отклонено'); reload();
  };
  return (
    <AdminPage title="Рефералы">
      {loading ? <Loading /> : (
        <Tbl head={['Когда', 'Код', 'Пригласил', 'Статус', 'Награда']} rows={(data ?? []).map((r) => [
          new Date(r.created_at).toLocaleString('ru-RU'), r.code, r.owner_name ?? '—', r.status,
          r.status === 'verified' ? <View key="act"><Act label="Начислить" tone="green" onPress={() => decide(r, true)} /><Act label="Отклонить" tone="red" onPress={() => decide(r, false)} /></View> : '—',
        ])} />
      )}
    </AdminPage>
  );
}
