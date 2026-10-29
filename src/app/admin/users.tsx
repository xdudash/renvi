import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminPage, Act, Badge, Busy, ErrorNote, FilterGroup, Pager, STATUS_LABEL, STATUS_TONE, SearchBox, Tbl, VERIF_LABEL, errText, fmtDate } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type AccountStatus, type UserRow, type Verification } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const LIMIT = 50;

type Demo = 'real' | 'demo';
type Sort = 'new' | 'reports' | 'active';

export default function AdminUsers() {
  const { t } = useLang();
  const params = useLocalSearchParams<{ demo?: string }>();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [verif, setVerif] = useState<Verification | null>(null);
  const [demo, setDemo] = useState<Demo | null>(params.demo === '1' ? 'demo' : null);
  const [sort, setSort] = useState<Sort | null>('new');
  const [offset, setOffset] = useState(0);
  // Debounced search; any filter change goes back to page 1.
  useEffect(() => { const h = setTimeout(() => { setQ(input.trim()); setOffset(0); }, 350); return () => clearTimeout(h); }, [input]);
  const filter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setOffset(0); };

  const cfg = useAsync(() => adminApi.config(), []);
  const countries = Array.from(new Set(['SK', 'CZ', ...(((cfg.data?.launch_countries as string[] | undefined) ?? []))]));
  const { data, error, loading, reload } = useAsync(() => adminApi.users({
    query: q || null, country, status, verification: verif, demo: demo === null ? null : demo === 'demo', sort: sort ?? 'new', limit: LIMIT, offset,
  }), [q, country, status, verif, demo, sort, offset]);

  const open = (u: UserRow) => router.push({ pathname: '/admin/user/[id]', params: { id: u.id } } as never);
  return (
    <AdminPage title={t('adm.users.title')} sub={t('adm.users.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      <SearchBox value={input} onChange={setInput} placeholder={t('adm.users.search')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22 }}>
        <FilterGroup label={t('adm.users.fCountry')} value={country} onChange={filter(setCountry)}
          options={[{ key: null, label: t('adm.common.all') }, ...countries.map((c) => ({ key: c, label: c }))]} />
        <FilterGroup<AccountStatus> label={t('adm.users.fStatus')} value={status} onChange={filter(setStatus)}
          options={[{ key: null, label: t('adm.common.all') }, ...(['active', 'suspended', 'banned'] as const).map((k) => ({ key: k, label: t(STATUS_LABEL[k]) }))]} />
        <FilterGroup<Verification> label={t('adm.users.fVerif')} value={verif} onChange={filter(setVerif)}
          options={[{ key: null, label: t('adm.common.all') }, ...(['pending', 'approved', 'rejected', 'none'] as const).map((k) => ({ key: k, label: t(VERIF_LABEL[k]) }))]} />
        <FilterGroup<Demo> label={t('adm.users.fDemo')} value={demo} onChange={filter(setDemo)}
          options={[{ key: null, label: t('adm.common.all') }, { key: 'real', label: t('adm.users.real') }, { key: 'demo', label: t('adm.users.demo') }]} />
        <FilterGroup<Sort> label={t('adm.users.fSort')} value={sort} onChange={filter(setSort)}
          options={[{ key: 'new', label: t('adm.users.sortNew') }, { key: 'reports', label: t('adm.users.sortReports') }, { key: 'active', label: t('adm.users.sortActive') }]} />
      </View>
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
          <Tbl widths={[230, 110, 110, 110, 90, 130, 120, 90]}
            head={[t('adm.users.colUser'), t('adm.users.colCountry'), t('adm.users.colStatus'), t('adm.users.colVerif'),
              t('adm.users.colReports'), t('adm.users.colActive'), t('adm.users.colCreated'), '']}
            rows={data.rows.map((u) => [
              <Pressable key="u" accessibilityRole="link" onPress={() => open(u)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{u.display_name ?? '—'}{u.age ? `, ${u.age}` : ''}</Text>
                <Text style={{ fontSize: 11, color: colors.sub }} selectable>{u.email}</Text>
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 3 }}>
                  {u.is_demo ? <Badge label={t('adm.users.demo')} tone="red" /> : null}
                  {u.is_admin ? <Badge label={t('adm.users.admin')} tone="ink" /> : null}
                  {!u.onboarding_done ? <Badge label={t('adm.users.draft')} /> : null}
                </View>
              </Pressable>,
              `${u.country}${u.city ? ` · ${u.city}` : ''}`,
              <View key="s"><Badge label={t(STATUS_LABEL[u.status])} tone={STATUS_TONE[u.status]} />{u.status === 'suspended' ? <Text style={{ fontSize: 10, color: colors.sub, marginTop: 2 }}>{t('adm.users.until', { date: fmtDate(u.suspended_until) })}</Text> : null}</View>,
              t(VERIF_LABEL[u.verification_status]),
              <Text key="r" style={{ fontSize: 12, color: u.reports_open > 0 ? colors.red : colors.ink, fontWeight: u.reports_open > 0 ? '800' : '400' }}>{`${u.reports_open} / ${u.reports_total}`}</Text>,
              fmtDate(u.last_active),
              fmtDate(u.created_at),
              <Act key="o" label={t('adm.users.open')} onPress={() => open(u)} />,
            ])} />
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
        </View>
      ) : null}
    </AdminPage>
  );
}
