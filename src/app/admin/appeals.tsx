import { View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';

type A = { id: string; report_id: string; user_id: string; details: string; status: string; created_at: string };

export default function AdminAppeals() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.from('appeals').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return d as A[];
  }, []);
  const decide = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc('admin_decide_appeal', { p_appeal: id, p_accept: accept });
    toast(error ? 'Ошибка' : 'Решение сохранено'); reload();
  };
  return (
    <AdminPage title="Апелляции">
      {loading ? <Loading /> : (
        <Tbl head={['Когда', 'Жалоба', 'Пользователь', 'Текст', 'Статус', '']} rows={(data ?? []).map((a) => [
          new Date(a.created_at).toLocaleString('ru-RU'), a.report_id.slice(0, 8), a.user_id.slice(0, 8), a.details, a.status,
          a.status === 'open' ? <View key="act"><Act label="Принять" tone="green" onPress={() => decide(a.id, true)} /><Act label="Отклонить" tone="red" onPress={() => decide(a.id, false)} /></View> : '—',
        ])} />
      )}
    </AdminPage>
  );
}
