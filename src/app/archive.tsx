import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Loading, Screen, Title, useToast } from '@/components/ui';
import { ChatRow } from '@/components/ChatRow';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 51 · Архив диалогов
export default function Archive() {
  const { t } = useLang();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.matches(), []);
  const rows = (data ?? []).filter((m) => m.archived);
  return (
    <Screen tabs="chats">
      <BackLink onPress={() => router.navigate('/chats')} />
      <Title kicker={t('screens.archive.kicker')} heading={t('screens.archive.heading')} sub={t('screens.archive.sub')} />
      {loading ? <Loading /> : (
        <Card>{rows.length ? rows.map((m) => <ChatRow key={m.match_id} m={m} sub={t('screens.archive.archived')} />) : <Text style={{ fontSize: 12, color: colors.sub }}>{t('screens.archive.empty')}</Text>}</Card>
      )}
      {rows.length ? (
        <Btn kind="secondary" label={t('screens.archive.restore')} onPress={async () => {
          try { await Promise.all(rows.map((m) => api.matchSettings(m.match_id, { archived: false }))); toast(t('screens.archive.restored')); reload(); router.navigate('/chats'); } catch { toast(t('screens.archive.restoreFailed')); }
        }} />
      ) : null}
    </Screen>
  );
}
