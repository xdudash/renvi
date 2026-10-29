import { useState } from 'react';
import { View } from 'react-native';
import { AdminPage, Act, Busy, ErrorNote, Pager, Tbl, errText, fmtDate } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { AdminError } from '@/lib/adminApi';

type E = { id: string; area: string; message: string; created_at: string; user_id: string | null };
const LIMIT = 100;

export default function AdminErrors() {
  const { t } = useLang();
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useAsync(async () => {
    const { data: d, error: e, count } = await supabase.from('error_events').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1);
    if (e) throw new AdminError(e.message, e.code);
    return { rows: d as E[], total: count ?? (d?.length ?? 0) };
  }, [offset]);
  return (
    <AdminPage title={t('screens.adminErrors.zhurnalOshibok')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
          <Tbl widths={[130, 120, 520, 110]} head={[t('screens.adminErrors.kogda'), t('screens.adminErrors.razdel'), t('screens.adminErrors.oshibka'), t('screens.adminErrors.polzovatel')]}
            rows={data.rows.map((e) => [fmtDate(e.created_at), e.area, e.message, e.user_id?.slice(0, 8) ?? '—'])} />
        </View>
      ) : null}
    </AdminPage>
  );
}
