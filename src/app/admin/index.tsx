import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminPage, Act, Banner, Busy, ErrorNote, Section, Tbl, errText, useWide } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type CountryRow } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const COLS: (keyof Omit<CountryRow, 'country'>)[] = ['users', 'published', 'new_week', 'active_today', 'suspended', 'banned', 'reports_open', 'appeals_open', 'pending_verifications'];

function Tile({ value, label, href, alert }: { value: number; label: string; href?: string; alert?: boolean }) {
  return (
    <Pressable accessibilityRole={href ? 'link' : undefined} onPress={href ? () => router.push(href as never) : undefined}
      style={{ minWidth: 150, flexGrow: 1, flexBasis: 150, borderTopWidth: 2, borderTopColor: alert ? colors.red : colors.ink, paddingVertical: 10 }}>
      <Text style={{ fontSize: 36, fontWeight: '900', letterSpacing: -1.5, color: alert ? colors.red : colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export default function AdminHome() {
  const { t } = useLang();
  const wide = useWide();
  const { data, error, loading, reload } = useAsync(() => adminApi.dashboard(), []);
  const head = [t('adm.dash.country'), t('adm.dash.users'), t('adm.dash.published'), t('adm.dash.newWeek'), t('adm.dash.active24'),
    t('adm.dash.suspended'), t('adm.dash.banned'), t('adm.dash.reportsOpen'), t('adm.dash.appealsOpen'), t('adm.dash.pendingVerif')];
  const rows = data?.countries ?? [];
  const sum = (k: (typeof COLS)[number]) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  return (
    <AdminPage title={t('adm.dash.title')} sub={t('adm.dash.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View>
          {data.demo_bots > 0 ? (
            <Banner tone="red">
              <Text style={{ color: colors.redDark, fontWeight: '800', fontSize: 14 }}>{t('adm.dash.demoBotsTitle', { n: data.demo_bots })}</Text>
              <Text style={{ color: colors.redDark, fontSize: 12, marginTop: 4 }}>{t('adm.dash.demoBotsCopy')}</Text>
              <View style={{ marginTop: 8 }}><Act label={t('adm.dash.demoBotsShow')} tone="red" onPress={() => router.push({ pathname: '/admin/users', params: { demo: '1' } } as never)} /></View>
            </Banner>
          ) : null}
          {data.missing_legal_urls.length > 0 || data.support_email_missing ? (
            <Banner tone="amber">
              <Text style={{ color: colors.amber, fontWeight: '800', fontSize: 14 }}>{t('adm.dash.configTitle')}</Text>
              {data.missing_legal_urls.length > 0 ? <Text style={{ color: colors.amber, fontSize: 12, marginTop: 4 }}>{t('adm.dash.legalMissing', { keys: data.missing_legal_urls.join(', ') })}</Text> : null}
              {data.support_email_missing ? <Text style={{ color: colors.amber, fontSize: 12, marginTop: 4 }}>{t('adm.dash.supportMissing')}</Text> : null}
              <View style={{ marginTop: 8 }}><Act label={t('adm.dash.openConfig')} tone="amber" onPress={() => router.push('/admin/config' as never)} /></View>
            </Banner>
          ) : null}
          {data.reports_stale > 0 ? <Banner tone="amber">{t('adm.dash.staleReports', { n: data.reports_stale })}</Banner> : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <Tile value={data.reports_unassigned} label={t('adm.dash.tileReportsNew', { total: data.reports_open })} href="/admin/reports" alert={data.reports_unassigned > 0} />
            <Tile value={data.appeals_open} label={t('adm.dash.tileAppeals')} href="/admin/appeals" alert={data.appeals_open > 0} />
            <Tile value={data.pending_verifications} label={t('adm.dash.tileVerif')} href="/admin/verification" />
            <Tile value={data.paid_subscribers} label={t('adm.dash.tilePaid')} />
            <Tile value={data.admins} label={t('adm.dash.tileAdmins')} href="/admin/admins" />
            <Tile value={data.demo_bots} label={t('adm.dash.tileDemo')} alert={data.demo_bots > 0} />
          </View>

          <Section title={t('adm.dash.byCountry')}>
            <Tbl head={head} widths={[90, ...COLS.map(() => (wide ? 108 : 96))]} empty={t('adm.dash.noUsers')} rows={[
              ...rows.map((r) => [r.country, ...COLS.map((k) => r[k])]),
              ...(rows.length > 1 ? [[t('adm.dash.total'), ...COLS.map((k) => sum(k))]] : []),
            ]} />
            <Text style={{ fontSize: 11, color: colors.sub, marginTop: 8 }}>{t('adm.dash.note')}</Text>
          </Section>
        </View>
      ) : null}
    </AdminPage>
  );
}
