import { Stack, router } from 'expo-router';
import { Screen, StateBlock, Loading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// Admin area: only for users listed in public.admins (checked again by every RPC on the server).
export default function AdminLayout() {
  const { t } = useLang();
  const { session } = useSession();
  const { data, error, loading, reload } = useAsync(async () => {
    if (!session) return false;
    const { data: ok, error: e } = await supabase.rpc('is_admin');
    // A failed check is not "no access": let the admin retry instead of showing a wrong verdict.
    if (e) throw e;
    return ok === true;
  }, [session?.user.id]);
  if (loading) return <Screen><Loading /></Screen>;
  if (error) return <Screen><StateBlock icon="!" title={t('adm.layout.checkFailed')} copy={error.message} label={t('adm.common.retry')} onPress={reload} /></Screen>;
  if (!data) return <Screen><StateBlock icon="×" title={t('admin.layout.noAccess')} copy={t('admin.layout.noAccessCopy')} label={t('admin.layout.home')} onPress={() => router.replace('/')} /></Screen>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
