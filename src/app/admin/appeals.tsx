import { View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

type A = { id: string; report_id: string; user_id: string; details: string; status: string; created_at: string };

export default function AdminAppeals() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.from('appeals').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return d as A[];
  }, []);
  const decide = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc('admin_decide_appeal', { p_appeal: id, p_accept: accept });
    toast(error ? t('screens.adminAppeals.oshibka') : t('screens.adminAppeals.reshenieSohraneno')); reload();
  };
  return (
    <AdminPage title={t('screens.adminAppeals.apellyatsii')}>
      {loading ? <Loading /> : (
        <Tbl head={[t('screens.adminAppeals.kogda'), t('screens.adminAppeals.zhaloba'), t('screens.adminAppeals.polzovatel'), t('screens.adminAppeals.tekst'), t('screens.adminAppeals.status'), '']} rows={(data ?? []).map((a) => [
          new Date(a.created_at).toLocaleString('ru-RU'), a.report_id.slice(0, 8), a.user_id.slice(0, 8), a.details, a.status,
          a.status === 'open' ? <View key="act"><Act label={t('screens.adminAppeals.prinyat')} tone="green" onPress={() => decide(a.id, true)} /><Act label={t('screens.adminAppeals.otklonit')} tone="red" onPress={() => decide(a.id, false)} /></View> : '—',
        ])} />
      )}
    </AdminPage>
  );
}
