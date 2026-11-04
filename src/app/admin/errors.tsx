import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminPage, Act, Busy, ErrorNote, Pager, Tbl, errText, fmtDate } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { adminApi } from '@/lib/adminApi';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

const LIMIT = 50;

// Errors reported by the app (newest first). Read-only: the app writes them, admins only look.
export default function AdminErrors() {
  const { t } = useLang();
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useAsync(() => adminApi.errors(LIMIT, offset), [offset]);
  return (
    <AdminPage title={t('adm.errors.title')} sub={t('adm.errors.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
          <Tbl widths={[130, 120, 520, 130]} head={[t('adm.errors.when'), t('adm.errors.area'), t('adm.errors.message'), t('adm.errors.user')]}
            rows={data.rows.map((e) => [
              fmtDate(e.created_at), e.area, e.message,
              e.user_id ? (
                <Pressable key="u" accessibilityRole="link" onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: e.user_id as string } } as never)}>
                  <Text style={{ fontSize: 12, color: colors.redDark }}>{e.user_id.slice(0, 8)}</Text>
                </Pressable>
              ) : '—',
            ])} />
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
        </View>
      ) : null}
    </AdminPage>
  );
}
