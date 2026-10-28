import { Image, View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/lib/supabase';

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
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.from('verification_requests').select('*').eq('status', 'pending').order('created_at').limit(100);
    if (error) throw error;
    return d as V[];
  }, []);
  const decide = async (v: V, status: 'approved' | 'rejected') => {
    const { error } = await supabase.rpc('admin_set_verification', { p_user: v.user_id, p_status: status });
    toast(error ? 'Ошибка' : status === 'approved' ? 'Подтверждено' : 'Отклонено'); reload();
  };
  return (
    <AdminPage title="Проверка селфи">
      {loading ? <Loading /> : (
        <Tbl head={['Когда', 'Селфи', 'Обложка анкеты', 'Решение']} rows={(data ?? []).map((v) => [
          new Date(v.created_at).toLocaleString('ru-RU'), <Selfie key="s" path={v.storage_path} />, <Cover key="c" uid={v.user_id} />,
          <View key="d"><Act label="Подтвердить" tone="green" onPress={() => decide(v, 'approved')} /><Act label="Отклонить" tone="red" onPress={() => decide(v, 'rejected')} /></View>,
        ])} />
      )}
    </AdminPage>
  );
}
