import { AdminPage, Tbl } from '@/components/AdminUI';
import { Loading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

type E = { id: string; area: string; message: string; created_at: string; user_id: string | null };

export default function AdminErrors() {
  const { t } = useLang();
  const { data, loading } = useAsync(async () => {
    const { data: d, error } = await supabase.from('error_events').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return d as E[];
  }, []);
  return (
    <AdminPage title={t('screens.adminErrors.zhurnalOshibok')}>
      {loading ? <Loading /> : (
        <Tbl head={[t('screens.adminErrors.kogda'), t('screens.adminErrors.razdel'), t('screens.adminErrors.oshibka'), t('screens.adminErrors.polzovatel')]} rows={(data ?? []).map((e) => [new Date(e.created_at).toLocaleString('ru-RU'), e.area, e.message, e.user_id?.slice(0, 8) ?? '—'])} />
      )}
    </AdminPage>
  );
}
