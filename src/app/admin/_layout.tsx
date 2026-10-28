import { Stack , router } from 'expo-router';
import { Text } from 'react-native';
import { Screen, StateBlock, Loading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// Admin area: only for users listed in public.admins (checked again by every RPC on the server).
export default function AdminLayout() {
  const { t } = useLang();
  const { session } = useSession();
  const { data, loading } = useAsync(async () => {
    if (!session) return false;
    const { data: ok } = await supabase.rpc('is_admin');
    return ok === true;
  }, [session?.user.id]);
  if (loading) return <Screen><Loading /></Screen>;
  if (!data) return <Screen><StateBlock icon="×" title={t('admin.layout.noAccess')} copy={t('admin.layout.noAccessCopy')} label={t('admin.layout.home')} onPress={() => router.replace('/')} /><Text /></Screen>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
