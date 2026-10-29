import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, BackLink, Btn, Card, LinkBtn, Loading, Screen, Title, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { localeOf } from '@/i18n/current';
import { ErrorRetryState } from '@/components/States';

type BlockedRow = { blocked_id: string; created_at: string };

// 78 · Заблокированные профили
export default function Blocked() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error } = await supabase.from('blocks').select('blocked_id, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return (rows ?? []) as BlockedRow[];
  }, []);
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/privacy-data')} />
      <Title kicker={t('screens.blocked.zablokirovannye')} heading={t('screens.blocked.kogoVyIsklyuchili')} sub={t('screens.blocked.profiliIzEtogoSpiska')} />
      {loading ? <Loading /> : error ? <ErrorRetryState onRetry={reload} /> : (
        <Card>
          {(data ?? []).length ? (data ?? []).map((b) => (
            <BlockedItem key={b.blocked_id} row={b} onUnblock={async () => { try { await api.unblock(b.blocked_id); toast(t('screens.blocked.profilRazblokirovan')); reload(); } catch { toast(t('screens.blocked.neUdalosRazblokirovat')); } }} />
          )) : <Text style={{ fontSize: 12, color: colors.sub }}>{t('screens.blocked.vyNikogoNeBlokirovali')}</Text>}
        </Card>
      )}
      <Btn kind="ghost" label={t('screens.blocked.vernutsyaVPrivatnost')} onPress={() => router.navigate('/privacy-data')} />
    </Screen>
  );
}

function BlockedItem({ row, onUnblock }: { row: BlockedRow; onUnblock: () => void }) {
  const { t } = useLang();
  const card = useAsync(() => api.profileCard(row.blocked_id), [row.blocked_id]);
  const url = useSignedUrl(card.data?.photos[0]?.path);
  const when = new Date(row.created_at).toLocaleDateString(localeOf(), { day: 'numeric', month: 'long' });
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 6 }}>
      <Pressable style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 6 }}>
        <Avatar uri={url} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 13 }}>{card.data ? (card.data.age ? `${card.data.display_name}, ${card.data.age}` : card.data.display_name) : t('screens.blocked.profil')}</Text>
          <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.blocked.zablokirovanWhen', { when })}</Text>
        </View>
      </Pressable>
      <LinkBtn label={t('screens.blocked.razblokirovat')} onPress={onUnblock} />
    </View>
  );
}
