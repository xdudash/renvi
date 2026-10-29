import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AdminPage, AdminPhoto, Act, Acts, Badge, Busy, ErrorNote, FilterGroup, OUTCOME_LABEL, Pager, REASON_LABEL, STATUS_LABEL, STATUS_TONE,
  errText, fmtDate, useActionDialog, useWide,
} from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type ReportOutcome, type ReportRow, type ReportState } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const LIMIT = 30;
const REASONS = ['harassment', 'scam', 'fake', 'photos', 'underage', 'illegal', 'other'] as const;
type Assigned = 'me' | 'none';

const muted = { fontSize: 11, color: colors.sub } as const;

export default function AdminReports() {
  const { t } = useLang();
  const toast = useToast();
  const wide = useWide();
  const params = useLocalSearchParams<{ target?: string }>();
  const [target, setTarget] = useState<string | null>(params.target ?? null);
  const [state, setState] = useState<ReportState | null>(params.target ? null : 'new');
  const [reason, setReason] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Assigned | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, openDialog] = useActionDialog();
  const { data, error, loading, reload } = useAsync(
    () => adminApi.reports({ state, reason, assigned, target, limit: LIMIT, offset }),
    [state, reason, assigned, target, offset],
  );
  const refresh = () => { setSelected([]); reload(); };
  const filter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setOffset(0); setSelected([]); };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const assign = async (r: ReportRow, on: boolean) => {
    try { await adminApi.assignReport(r.id, on); toast(on ? t('adm.reports.taken') : t('adm.reports.released')); refresh(); }
    catch (e) { toast(t('adm.common.error', { message: errText(e) })); }
  };
  const resolve = (r: ReportRow, outcome: ReportOutcome) => {
    const label = t(OUTCOME_LABEL[outcome]);
    openDialog({
      title: t('adm.reports.resolveTitle', { outcome: label }),
      body: outcome === 'dismissed' ? t('adm.reports.resolveDismissBody') : outcome === 'actioned' ? t('adm.reports.resolveActionedBody')
        : t('adm.reports.resolveSanctionBody', { name: r.target_name ?? '—' }),
      confirmLabel: label,
      tone: outcome === 'dismissed' ? 'green' : outcome === 'warning' || outcome === 'actioned' ? 'ink' : 'red',
      reasonLabel: t('adm.reports.noteLabel'),
      days: outcome === 'suspension' ? 7 : undefined,
      extra: r.target_message_id && !r.message_deleted_at ? { label: t('adm.reports.removeMessage'), value: outcome !== 'dismissed' } : undefined,
      onConfirm: ({ reason: note, days, extra }) => adminApi.resolveReport(r.id, outcome, note, outcome === 'suspension' ? days : undefined, extra),
      onDone: () => { toast(t('adm.reports.resolved')); refresh(); },
    });
  };
  const bulkAssign = async () => {
    let failed = 0;
    for (const id of selected) { try { await adminApi.assignReport(id, true); } catch { failed++; } }
    toast(failed ? t('adm.reports.bulkPartial', { failed }) : t('adm.reports.taken')); refresh();
  };
  const bulkDismiss = () => openDialog({
    title: t('adm.reports.bulkDismissTitle', { n: selected.length }), body: t('adm.reports.resolveDismissBody'),
    confirmLabel: t(OUTCOME_LABEL.dismissed), tone: 'green', reasonLabel: t('adm.reports.noteLabel'),
    onConfirm: async ({ reason: note }) => {
      const failed: string[] = [];
      for (const id of selected) { try { await adminApi.resolveReport(id, 'dismissed', note); } catch (e) { failed.push(errText(e)); } }
      if (failed.length) { refresh(); setSelected([]); }
      if (failed.length) throw new Error(t('adm.reports.bulkPartial', { failed: failed.length }) + ` (${failed[0]})`);
    },
    onDone: () => { toast(t('adm.reports.resolved')); refresh(); },
  });

  const openable = (data?.rows ?? []).filter((r) => r.status === 'open');
  return (
    <AdminPage title={t('adm.reports.title')} sub={t('adm.reports.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={refresh} />}>
      {dialog}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22 }}>
        <FilterGroup<ReportState> label={t('adm.reports.fState')} value={state} onChange={filter(setState)} options={[
          { key: 'new', label: t('adm.reports.stateNew') }, { key: 'review', label: t('adm.reports.stateReview') },
          { key: 'resolved', label: t('adm.reports.stateResolved') }, { key: null, label: t('adm.common.all') }]} />
        <FilterGroup<Assigned> label={t('adm.reports.fAssigned')} value={assigned} onChange={filter(setAssigned)} options={[
          { key: null, label: t('adm.common.all') }, { key: 'me', label: t('adm.reports.mine') }, { key: 'none', label: t('adm.reports.unassigned') }]} />
        <FilterGroup<string> label={t('adm.reports.fReason')} value={reason} onChange={filter(setReason)} options={[
          { key: null, label: t('adm.common.all') }, ...REASONS.map((k) => ({ key: k, label: t(REASON_LABEL[k]) }))]} />
      </View>
      {target ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <Badge label={t('adm.reports.onlyUser', { id: target.slice(0, 8) })} tone="ink" />
          <Act label={t('adm.reports.clearUser')} tone="ghost" onPress={() => { setTarget(null); setOffset(0); }} />
        </View>
      ) : null}
      {error ? <ErrorNote message={errText(error)} onRetry={refresh} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Pager total={data.total} offset={offset} limit={LIMIT} onChange={(o) => { setOffset(o); setSelected([]); }} />
            {openable.length > 0 ? <Act label={selected.length === openable.length ? t('adm.reports.selectNone') : t('adm.reports.selectAll')} tone="ghost"
              onPress={() => setSelected(selected.length === openable.length ? [] : openable.map((r) => r.id))} /> : null}
            {selected.length > 0 ? <>
              <Act label={t('adm.reports.bulkTake', { n: selected.length })} onPress={bulkAssign} />
              <Act label={t('adm.reports.bulkDismiss', { n: selected.length })} tone="green" onPress={bulkDismiss} />
            </> : null}
          </View>
          {data.rows.length === 0 ? <Text style={[muted, { paddingVertical: 16 }]}>{t('adm.reports.empty')}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {data.rows.map((r) => (
              <ReportCard key={r.id} r={r} wide={wide} selected={selected.includes(r.id)} onToggle={() => toggle(r.id)}
                onAssign={(on) => assign(r, on)} onResolve={(o) => resolve(r, o)} />
            ))}
          </View>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={(o) => { setOffset(o); setSelected([]); }} />
        </View>
      ) : null}
    </AdminPage>
  );
}

function ReportCard({ r, wide, selected, onToggle, onAssign, onResolve }: {
  r: ReportRow; wide: boolean; selected: boolean; onToggle: () => void; onAssign: (on: boolean) => void; onResolve: (o: ReportOutcome) => void;
}) {
  const { t } = useLang();
  const stateTone = r.state === 'new' ? 'red' : r.state === 'review' ? 'amber' : 'green';
  const stateLabel = r.state === 'new' ? t('adm.reports.stateNew') : r.state === 'review' ? t('adm.reports.stateReview') : t('adm.reports.stateResolved');
  const user = (id: string) => router.push({ pathname: '/admin/user/[id]', params: { id } } as never);
  return (
    <View style={{ width: wide ? '49%' : '100%', backgroundColor: colors.white, borderWidth: 1, borderColor: selected ? colors.ink : colors.line, borderRadius: 14, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {r.status === 'open' ? (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onToggle}
            style={{ width: 18, height: 18, borderWidth: 1, borderColor: colors.ink, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.ink : 'transparent' }}>
            {selected ? <Text style={{ color: colors.paper, fontSize: 11 }}>✓</Text> : null}
          </Pressable>
        ) : null}
        <Badge label={stateLabel} tone={stateTone} />
        <Badge label={REASON_LABEL[r.reason] ? t(REASON_LABEL[r.reason]) : r.reason} tone="ink" />
        {r.decision || r.status !== 'open' ? <Badge label={t(OUTCOME_LABEL[r.decision ?? r.status] ?? 'adm.outcome.dismissed')} /> : null}
        {r.appeals_open > 0 ? <Badge label={t('adm.reports.hasAppeal')} tone="amber" /> : null}
        <Text style={muted}>{fmtDate(r.created_at)} · #{r.id.slice(0, 8)}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        <Pressable onPress={() => user(r.reporter_id)}><Text style={{ fontSize: 12, color: colors.redDark }}>{r.reporter_name ?? r.reporter_id.slice(0, 8)}</Text></Pressable>
        <Text style={muted}>→</Text>
        {r.target_profile_id ? (
          <Pressable onPress={() => user(r.target_profile_id as string)}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.redDark }}>{r.target_name ?? r.target_profile_id.slice(0, 8)}</Text>
          </Pressable>
        ) : <Text style={muted}>{t('adm.reports.deletedProfile')}</Text>}
        {r.target_profile_id ? <Badge label={t(STATUS_LABEL[r.target_status])} tone={STATUS_TONE[r.target_status]} /> : null}
        {r.target_country ? <Text style={muted}>{r.target_country}</Text> : null}
        {r.target_reports > 1 ? <Text style={[muted, { color: colors.red, fontWeight: '700' }]}>{t('adm.reports.targetReports', { n: r.target_reports })}</Text> : null}
      </View>
      {r.details ? <Text style={{ fontSize: 13, color: colors.ink, marginTop: 8 }} selectable>{r.details}</Text> : null}
      {r.target_message_id ? (
        <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceMuted }}>
          <Text style={muted}>{t('adm.reports.message')}{r.message_deleted_at ? ` · ${t('adm.reports.messageDeleted')}` : ''}</Text>
          <Text style={{ fontSize: 13, color: colors.ink }} selectable>{r.message_snapshot ?? r.message_body ?? '—'}</Text>
          {r.message_body && r.message_snapshot && r.message_body !== r.message_snapshot ? <Text style={muted} selectable>{t('adm.reports.messageNow', { body: r.message_body })}</Text> : null}
          {r.message_photo_path ? <View style={{ marginTop: 6 }}><AdminPhoto path={r.message_photo_path} w={140} h={140} /></View> : null}
        </View>
      ) : null}
      {r.reason === 'photos' && r.target_profile_id ? <Text style={[muted, { marginTop: 6 }]}>{t('adm.reports.photosHint')}</Text> : null}
      <Text style={[muted, { marginTop: 8 }]}>
        {r.assigned_email ? t('adm.reports.assignedTo', { email: r.assigned_email }) : t('adm.reports.unassigned')}
        {r.resolved_by_email ? ` · ${t('adm.reports.resolvedBy', { email: r.resolved_by_email, date: fmtDate(r.decided_at) })}` : ''}
      </Text>
      {r.resolution_note ? <Text style={{ fontSize: 12, color: colors.ink, marginTop: 4 }} selectable>{t('adm.reports.note')}: {r.resolution_note}</Text> : null}
      {r.status === 'open' ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Acts>
            {r.state === 'new' ? <Act label={t('adm.reports.take')} tone="ghost" onPress={() => onAssign(true)} /> : <Act label={t('adm.reports.release')} tone="ghost" onPress={() => onAssign(false)} />}
            <Act label={t(OUTCOME_LABEL.dismissed)} tone="green" onPress={() => onResolve('dismissed')} />
            <Act label={t(OUTCOME_LABEL.actioned)} onPress={() => onResolve('actioned')} />
            {r.target_profile_id ? <>
              <Act label={t(OUTCOME_LABEL.warning)} onPress={() => onResolve('warning')} />
              <Act label={t(OUTCOME_LABEL.suspension)} tone="amber" onPress={() => onResolve('suspension')} />
              <Act label={t(OUTCOME_LABEL.ban)} tone="red" onPress={() => onResolve('ban')} />
            </> : null}
          </Acts>
        </View>
      ) : null}
    </View>
  );
}
