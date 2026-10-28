import { Image, View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

type V = { id: string; user_id: string; storage_path: string; status: string; created_at: string };

function Selfie({ path }: { path: string }) {
  const url = useSignedUrl(path);
  return url ? <Image source={{ uri: url }} style={{ width: 120, height: 150, borderRadius: 10 }} /> : null;
}
function Cover({ uid }: { uid: string }) {
  const { data } = useAsync(async () => (await supabase.from('profile_photos').select('storage_path').eq('profile_id', uid).order('position').limit(1)).data?.[0]?.storage_path ?? null, [uid]);
  const url = useSignedUrl(data);
  return url ? <Image source={{ uri: url }} style={{ width: 120, height: 150, borderRadius: 10 }} /> : null;
}

// Manual selfie check: the moderator compares the selfie with the profile cover and sets the "verified" badge.
export default function AdminVerification() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.from('verification_requests').select('*').eq('status', 'pending').order('created_at').limit(100);
    if (error) throw error;
    return d as V[];
  }, []);
  const decide = async (v: V, status: 'approved' | 'rejected') => {
    const { error } = await supabase.rpc('admin_set_verification', { p_user: v.user_id, p_status: status });
    toast(error ? t('admin.verification.error') : status === 'approved' ? t('admin.verification.approved') : t('admin.verification.rejected')); reload();
  };
  return (
    <AdminPage title={t('admin.verification.title')}>
      {loading ? <Loading /> : (
        <Tbl head={[t('admin.verification.colWhen'), t('admin.verification.colSelfie'), t('admin.verification.colCover'), t('admin.verification.colDecision')]} rows={(data ?? []).map((v) => [
          new Date(v.created_at).toLocaleString('ru-RU'), <Selfie key="s" path={v.storage_path} />, <Cover key="c" uid={v.user_id} />,
          <View key="d"><Act label={t('admin.verification.approve')} tone="green" onPress={() => decide(v, 'approved')} /><Act label={t('admin.verification.reject')} tone="red" onPress={() => decide(v, 'rejected')} /></View>,
        ])} />
      )}
    </AdminPage>
  );
}
