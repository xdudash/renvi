import { View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

type Rf = { invited_user: string; code: string; status: string; created_at: string; owner_name: string | null };

export default function AdminReferrals() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.rpc('admin_referrals');
    if (error) throw error;
    return d as Rf[];
  }, []);
  const decide = async (r: Rf, approve: boolean) => {
    const { error } = await supabase.rpc('admin_decide_referral', { p_invited: r.invited_user, p_approve: approve });
    toast(error ? t('screens.adminReferrals.oshibka') : approve ? t('screens.adminReferrals.nagradaNachislena') : t('screens.adminReferrals.otkloneno')); reload();
  };
  return (
    <AdminPage title={t('screens.adminReferrals.referaly')}>
      {loading ? <Loading /> : (
        <Tbl head={[t('screens.adminReferrals.kogda'), t('screens.adminReferrals.kod'), t('screens.adminReferrals.priglasil'), t('screens.adminReferrals.status'), t('screens.adminReferrals.nagrada')]} rows={(data ?? []).map((r) => [
          new Date(r.created_at).toLocaleString('ru-RU'), r.code, r.owner_name ?? '—', r.status,
          r.status === 'verified' ? <View key="act"><Act label={t('screens.adminReferrals.nachislit')} tone="green" onPress={() => decide(r, true)} /><Act label={t('screens.adminReferrals.otklonit')} tone="red" onPress={() => decide(r, false)} /></View> : '—',
        ])} />
      )}
    </AdminPage>
  );
}
