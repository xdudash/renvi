import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminPage, Act, Badge, Busy, ErrorNote, FilterGroup, Pager, Tbl, errText, fmtDate } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { adminApi } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const LIMIT = 50;
const GROUPS = ['user.', 'report.', 'appeal.', 'verification.', 'config.', 'admin.', 'photo.', 'referral.'] as const;

// Who did what and when. Rows are written only by the admin RPCs (admin_actions is read-only for clients).
export default function AdminAudit() {
  const { t } = useLang();
  const params = useLocalSearchParams<{ target?: string }>();
  const [action, setAction] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(params.target ?? null);
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useAsync(() => adminApi.audit({ action, target, limit: LIMIT, offset }), [action, target, offset]);
  return (
    <AdminPage title={t('adm.audit.title')} sub={t('adm.audit.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      <FilterGroup<string> label={t('adm.audit.fAction')} value={action} onChange={(v) => { setAction(v); setOffset(0); }}
        options={[{ key: null, label: t('adm.common.all') }, ...GROUPS.map((g) => ({ key: g, label: g.replace('.', '') }))]} />
      {target ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <Badge label={t('adm.reports.onlyUser', { id: target.slice(0, 8) })} tone="ink" />
          <Act label={t('adm.reports.clearUser')} tone="ghost" onPress={() => { setTarget(null); setOffset(0); }} />
        </View>
      ) : null}
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
          <Tbl widths={[130, 170, 150, 190, 240, 280]}
            head={[t('adm.audit.when'), t('adm.audit.admin'), t('adm.audit.action'), t('adm.audit.target'), t('adm.audit.reason'), t('adm.audit.details')]}
            rows={data.rows.map((a) => [
              fmtDate(a.created_at),
              a.admin_email ?? '—',
              <Text key="a" style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{a.action}</Text>,
              a.target_user ? (
                <Pressable key="t" onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: a.target_user as string } } as never)}>
                  <Text style={{ fontSize: 12, color: colors.redDark }}>{a.target_name ?? a.target_email ?? a.target_user.slice(0, 8)}</Text>
                  {a.target_email ? <Text style={{ fontSize: 10, color: colors.sub }}>{a.target_email}</Text> : null}
                </Pressable>
              ) : (a.target_id ?? '—'),
              a.reason ?? '—',
              <Text key="d" style={{ fontSize: 10, color: colors.sub, fontFamily: 'Courier' }} selectable numberOfLines={6}>{JSON.stringify(a.details)}</Text>,
            ])} />
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
        </View>
      ) : null}
    </AdminPage>
  );
}
