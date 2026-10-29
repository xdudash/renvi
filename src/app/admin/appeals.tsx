import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AdminPage, Act, Acts, Badge, Busy, ErrorNote, FilterGroup, OUTCOME_LABEL, Pager, REASON_LABEL, STATUS_LABEL, STATUS_TONE,
  errText, fmtDate, useActionDialog, useWide,
} from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type AppealRow } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const LIMIT = 30;
type St = 'open' | 'accepted' | 'rejected';
const muted = { fontSize: 11, color: colors.sub } as const;

export default function AdminAppeals() {
  const { t } = useLang();
  const toast = useToast();
  const wide = useWide();
  const [status, setStatus] = useState<St | null>('open');
  const [offset, setOffset] = useState(0);
  const [dialog, openDialog] = useActionDialog();
  const { data, error, loading, reload } = useAsync(() => adminApi.appeals(status, LIMIT, offset), [status, offset]);

  const decide = (a: AppealRow, accept: boolean) => openDialog({
    title: accept ? t('adm.appeals.acceptTitle', { name: a.user_name ?? a.user_email }) : t('adm.appeals.rejectTitle', { name: a.user_name ?? a.user_email }),
    body: (accept
      ? (a.role === 'target' ? t('adm.appeals.acceptTargetBody', { n: a.active_sanctions }) : t('adm.appeals.acceptReporterBody'))
      : t('adm.appeals.rejectBody')) + ' ' + t('adm.appeals.reasonVisible'),
    confirmLabel: accept ? t('adm.appeals.accept') : t('adm.appeals.reject'),
    tone: accept ? 'green' : 'red',
    reasonLabel: t('adm.appeals.reasonLabel'),
    onConfirm: async ({ reason }) => {
      const res = await adminApi.decideAppeal(a.id, accept, reason);
      toast(accept ? (res.report_reopened ? t('adm.appeals.reopened') : t('adm.appeals.lifted', { n: res.lifted })) : t('adm.appeals.rejected'));
    },
    onDone: reload,
  });

  return (
    <AdminPage title={t('adm.appeals.title')} sub={t('adm.appeals.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      {dialog}
      <FilterGroup<St> label={t('adm.appeals.fStatus')} value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[
        { key: 'open', label: t('adm.appeals.open') }, { key: 'accepted', label: t('adm.appeals.accepted') },
        { key: 'rejected', label: t('adm.appeals.rejectedF') }, { key: null, label: t('adm.common.all') }]} />
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
          {data.rows.length === 0 ? <Text style={[muted, { paddingVertical: 16 }]}>{t('adm.appeals.empty')}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {data.rows.map((a) => (
              <View key={a.id} style={{ width: wide ? '49%' : '100%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                  <Badge label={a.status === 'open' ? t('adm.appeals.open') : a.status === 'accepted' ? t('adm.appeals.accepted') : t('adm.appeals.rejectedF')}
                    tone={a.status === 'open' ? 'amber' : a.status === 'accepted' ? 'green' : 'red'} />
                  <Badge label={a.role === 'target' ? t('adm.appeals.roleTarget') : t('adm.appeals.roleReporter')} tone="ink" />
                  <Text style={muted}>{fmtDate(a.created_at)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: a.user_id } } as never)}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.redDark }}>{a.user_name ?? '—'}</Text>
                  </Pressable>
                  <Text style={muted} selectable>{a.user_email}</Text>
                  <Badge label={t(STATUS_LABEL[a.user_status])} tone={STATUS_TONE[a.user_status]} />
                  {a.user_status === 'suspended' ? <Text style={muted}>{t('adm.users.until', { date: fmtDate(a.user_suspended_until) })}</Text> : null}
                </View>
                <Text style={{ fontSize: 13, color: colors.ink, marginTop: 8 }} selectable>{a.details}</Text>
                <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceMuted }}>
                  <Text style={muted}>{t('adm.appeals.report', { id: a.report.id.slice(0, 8), date: fmtDate(a.report.created_at) })}</Text>
                  <Text style={{ fontSize: 12, color: colors.ink }}>
                    {REASON_LABEL[a.report.reason] ? t(REASON_LABEL[a.report.reason]) : a.report.reason} · {a.report.status === 'open' ? t('adm.reports.stateOpen') : t(OUTCOME_LABEL[a.report.decision ?? a.report.status] ?? 'adm.outcome.dismissed')}
                  </Text>
                  {a.report.details ? <Text style={muted} selectable>{a.report.details}</Text> : null}
                  {a.report.message_snapshot ? <Text style={[muted, { fontStyle: 'italic' }]} selectable>«{a.report.message_snapshot}»</Text> : null}
                  {a.report.resolution_note ? <Text style={muted}>{t('adm.reports.note')}: {a.report.resolution_note}</Text> : null}
                  {a.role === 'target' ? <Text style={muted}>{t('adm.appeals.activeSanctions', { n: a.active_sanctions })}</Text> : null}
                </View>
                {a.decision_reason ? (
                  <Text style={{ fontSize: 12, color: colors.ink, marginTop: 8 }}>{t('adm.appeals.decidedBy', { email: a.decided_by_email ?? '—', date: fmtDate(a.decided_at) })}: {a.decision_reason}</Text>
                ) : null}
                {a.status === 'open' ? (
                  <View style={{ marginTop: 10 }}>
                    <Acts>
                      <Act label={t('adm.appeals.accept')} tone="green" onPress={() => decide(a, true)} />
                      <Act label={t('adm.appeals.reject')} tone="red" onPress={() => decide(a, false)} />
                    </Acts>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
        </View>
      ) : null}
    </AdminPage>
  );
}
