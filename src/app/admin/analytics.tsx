import { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminPage, Act, Banner, Busy, ErrorNote, Section, Stat, Tbl, errText, fmtDuration } from '@/components/AdminUI';
import { eventLabels } from '@/components/AdminUserAnalytics';
import { useAsync } from '@/hooks/useAsync';
import { analyticsApi, type Retention } from '@/lib/analyticsApi';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';

// First visit and sign-up happen before the user can consent, so they are not measured and not shown.
const STAGES: [string, TranslationKey][] = [
  ['measured_session', 'analytics.measuredSession'], ['onboard', 'analytics.onboard'], ['like', 'analytics.like'],
  ['match', 'analytics.match'], ['date', 'analytics.date'],
];
const PERIODS = [7, 30, 90, 180];
const WEEKDAY: TranslationKey[] = ['adm.cfg.wd0', 'adm.cfg.wd1', 'adm.cfg.wd2', 'adm.cfg.wd3', 'adm.cfg.wd4', 'adm.cfg.wd5', 'adm.cfg.wd6'];
const note = { color: colors.sub, fontSize: 12, marginBottom: 10 } as const;

// Users, engagement, time in the app, sessions and acquisition. Numbers come from admin_analytics() (consented users only).
export default function AnalyticsPage() {
  const { t } = useLang();
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => analyticsApi.report(days), [days]);
  const retentionRow = (r: Retention) => [r.d, r.eligible, r.returned, r.eligible ? `${(100 * r.returned / r.eligible).toFixed(1)}%` : '—'];
  const retentionHead = [t('analytics.day'), t('analytics.eligible'), t('analytics.returned'), t('analytics.rate')];
  const none = t('adm.common.empty');
  return (
    <AdminPage title={t('adm.nav.analytics')} sub={t('analytics.period', { days })} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {PERIODS.map((d) => <Act key={d} label={t('analytics.period', { days: d })} tone={days === d ? 'ink' : 'ghost'} onPress={() => setDays(d)} />)}
      </View>
      <Banner><Text style={{ color: colors.amber, fontSize: 12 }}>{t('analytics.note')}</Text><Text style={{ color: colors.amber, fontSize: 12, marginTop: 6 }}>{t('analytics.population')}</Text></Banner>
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <Stat value={data.total} label={t('analytics.total')} />
            <Stat value={data.new} label={t('analytics.new')} />
            <Stat value={data.consented} label={t('analytics.consented')} />
            <Stat value={data.measured} label={t('analytics.measured')} />
            <Stat value={data.dau} label={t('analytics.dau')} />
            <Stat value={data.wau} label={t('analytics.wau')} />
            <Stat value={data.mau} label={t('analytics.mau')} />
            <Stat value={data.online} label={t('analytics.online')} />
            <Stat value={data.sessions} label={t('analytics.sessions')} />
            <Stat value={fmtDuration(data.active_seconds)} label={t('analytics.time')} />
            <Stat value={data.sessions ? fmtDuration(data.active_seconds / data.sessions) : '—'} label={t('analytics.meanTime')} />
          </View>
          <Section title={t('analytics.demographics')}>
            <Tbl head={[t('analytics.country'), t('analytics.gender'), t('analytics.age'), t('analytics.users')]} widths={[100, 140, 120, 100]} rows={data.demographics.map((r) => [r.country, r.gender, r.age_group, r.users])} empty={none} />
          </Section>
          <Section title={t('analytics.acquisition')}>
            <Tbl head={[t('analytics.source'), t('analytics.medium'), t('analytics.campaign'), t('analytics.referral'), t('analytics.users')]} widths={[130, 130, 170, 150, 100]}
              rows={data.acquisition.map((r) => [r.source, r.medium ?? '—', r.campaign ?? '—', r.referral ?? '—', r.users])} empty={none} />
          </Section>
          <Section title={t('analytics.funnel')}>
            <Text style={note}>{t('analytics.funnelNote')}</Text>
            <Tbl head={[t('analytics.stage'), t('analytics.users')]} widths={[280, 160]} rows={STAGES.map(([key, label]) => [t(label), data.funnel[key] ?? '—'])} empty={none} />
          </Section>
          <Section title={t('analytics.screens')}>
            <Tbl head={[t('analytics.screen'), t('analytics.views'), t('analytics.seconds')]} widths={[220, 120, 120]} rows={data.screens.map((r) => [r.screen, r.views, r.active_seconds])} empty={none} />
          </Section>
          <Section title={t('analytics.hourly')}>
            <Tbl head={[t('analytics.hour'), t('analytics.count'), t('analytics.seconds')]} widths={[140, 120, 120]} rows={data.hourly.map((r) => [r.hour, r.events, r.active_seconds])} empty={none} />
          </Section>
          <Section title={t('analytics.weekdays')}>
            <Tbl head={[t('analytics.weekday'), t('analytics.count'), t('analytics.seconds')]} widths={[220, 120, 120]} rows={data.weekdays.map((r) => [WEEKDAY[r.weekday] ? t(WEEKDAY[r.weekday]) : r.weekday, r.events, r.active_seconds])} empty={none} />
          </Section>
          <Section title={t('analytics.actions')}>
            <Tbl head={[t('analytics.event'), t('analytics.count')]} widths={[280, 120]} rows={data.actions.map((r) => [eventLabels[r.event] ? t(eventLabels[r.event]) : r.event, r.events])} empty={none} />
          </Section>
          <Section title={t('analytics.retention')}>
            <Text style={note}>{t('analytics.retentionNote')}</Text>
            <Tbl head={retentionHead} widths={[100, 110, 110, 100]} rows={data.retention.map(retentionRow)} empty={none} />
          </Section>
          <Section title={t('analytics.cohorts')}>
            <Tbl head={[t('analytics.week'), ...retentionHead]} widths={[150, 100, 110, 110, 100]} rows={data.cohorts.map((r) => [r.week ?? '—', ...retentionRow(r)])} empty={none} />
          </Section>
        </View>
      ) : null}
    </AdminPage>
  );
}
