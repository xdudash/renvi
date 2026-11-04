import { Text } from 'react-native';
import { Section, Tbl, Busy, ErrorNote, errText, fmtDate, fmtDuration } from './AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { analyticsApi } from '@/lib/analyticsApi';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';

export const eventLabels: Record<string, TranslationKey> = {
  screen_view: 'analytics.screenView', heartbeat: 'analytics.heartbeat', onboard: 'analytics.onboard',
  like: 'analytics.like', match: 'analytics.match', date: 'analytics.date',
};

// Measured activity of one user (only with their consent; demo accounts are excluded on the server).
export function AdminUserAnalytics({ userId }: { userId: string }) {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(() => analyticsApi.user(userId), [userId]);
  return (
    <Section title={t('analytics.timeline')}>
      <Text style={{ color: colors.sub, fontSize: 12, marginBottom: 10 }}>{t('analytics.timelineNote')}</Text>
      {loading && !data ? <Busy /> : null}
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {data?.excluded ? <Text style={{ color: colors.ink }}>{t('analytics.demoExcluded')}</Text> : data ? (
        <>
          <Text style={{ color: colors.ink, fontSize: 12, marginBottom: 10 }}>
            {t(data.consented ? 'analytics.consentOn' : 'analytics.consentOff')} · {t('analytics.sessions')}: {data.sessions ?? 0} · {t('analytics.time')}: {fmtDuration(data.active_seconds)}
          </Text>
          <Tbl head={[t('analytics.at'), t('analytics.event'), t('analytics.screen'), t('analytics.seconds')]} widths={[130, 170, 120, 90]} empty={t('adm.common.empty')}
            rows={data.timeline.map((e) => [fmtDate(e.created_at), eventLabels[e.event] ? t(eventLabels[e.event]) : e.event, e.screen ?? '—', e.active_seconds])} />
        </>
      ) : null}
    </Section>
  );
}
