import { AdminUserAnalytics } from '@/components/AdminUserAnalytics';
import IdentityCorrection from '@/components/admin/IdentityCorrection';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AdminPage, AdminPhoto, Act, Acts, Badge, Busy, Columns, ErrorNote, KV, OUTCOME_LABEL, REASON_LABEL, STATUS_LABEL, STATUS_TONE,
  Section, VERIF_LABEL, errText, fmtDate, useActionDialog,
} from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type Sanction } from '@/lib/adminApi';
import { promptLabel } from '@/lib/catalog';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import type { TranslationKey } from '@/i18n';

const KIND_LABEL: Record<Sanction['kind'], TranslationKey> = { warning: 'adm.kind.warning', suspension: 'adm.kind.suspension', ban: 'adm.kind.ban' };

function Line({ children }: { children: ReactNode }) {
  return <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 8 }}>{children}</View>;
}
const small = { fontSize: 12, color: colors.ink } as const;
const muted = { fontSize: 11, color: colors.sub } as const;

export default function AdminUserDetail() {
  const { t } = useLang();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: u, error, loading, reload } = useAsync(() => adminApi.user(String(id)), [id]);
  const [dialog, openDialog] = useActionDialog();
  const done = (msg: string) => () => { toast(msg); reload(); };

  if (!u) {
    return <AdminPage title={t('adm.user.title')}>{error ? <ErrorNote message={errText(error)} onRetry={reload} /> : loading ? <Busy /> : null}</AdminPage>;
  }
  const p = u.profile;
  const name = `${p.display_name ?? '—'}${p.age ? `, ${p.age}` : ''}`;

  const warn = () => openDialog({ title: t('adm.user.warnTitle', { name }), body: t('adm.user.warnBody'), confirmLabel: t('adm.user.warn'),
    onConfirm: ({ reason }) => adminApi.sanction(p.id, 'warning', reason), onDone: done(t('adm.common.saved')) });
  const suspend = () => openDialog({ title: t('adm.user.suspendTitle', { name }), body: t('adm.user.suspendBody'), confirmLabel: t('adm.user.suspend'), days: 7, tone: 'red',
    onConfirm: ({ reason, days }) => adminApi.sanction(p.id, 'suspension', reason, days), onDone: done(t('adm.common.saved')) });
  const ban = () => openDialog({ title: t('adm.user.banTitle', { name }), body: t('adm.user.banBody'), confirmLabel: t('adm.user.ban'), tone: 'red',
    onConfirm: ({ reason }) => adminApi.sanction(p.id, 'ban', reason), onDone: done(t('adm.common.saved')) });
  const liftAll = () => openDialog({ title: t('adm.user.liftTitle', { name }), body: t('adm.user.liftBody'), confirmLabel: t('adm.user.lift'), tone: 'green',
    onConfirm: ({ reason }) => adminApi.lift(p.id, reason), onDone: done(t('adm.common.saved')) });
  const liftOne = (s: Sanction) => openDialog({ title: t('adm.user.liftOneTitle', { kind: t(KIND_LABEL[s.kind]) }), confirmLabel: t('adm.user.lift'), tone: 'green',
    onConfirm: ({ reason }) => adminApi.lift(p.id, reason, s.id), onDone: done(t('adm.common.saved')) });
  const approve = () => openDialog({ title: t('adm.user.approveTitle', { name }), confirmLabel: t('adm.verify.approve'), tone: 'green', reason: 'optional',
    onConfirm: ({ reason }) => adminApi.verify(p.id, 'approved', reason || undefined), onDone: done(t('adm.verify.approvedToast')) });
  const reject = () => openDialog({ title: t('adm.user.rejectTitle', { name }), body: t('adm.verify.reasonVisible'), confirmLabel: t('adm.verify.reject'), tone: 'red',
    presets: [t('adm.verify.presetFace'), t('adm.verify.presetMismatch'), t('adm.verify.presetQuality')],
    onConfirm: ({ reason }) => adminApi.verify(p.id, 'rejected', reason), onDone: done(t('adm.verify.rejectedToast')) });
  const revoke = () => openDialog({ title: t('adm.user.revokeTitle', { name }), body: t('adm.verify.reasonVisible'), confirmLabel: t('adm.user.revoke'), tone: 'red',
    onConfirm: ({ reason }) => adminApi.verify(p.id, 'revoked', reason), onDone: done(t('adm.common.saved')) });
  const removePhoto = (photoId: string) => openDialog({ title: t('adm.user.removePhotoTitle'), body: t('adm.user.removePhotoBody'), confirmLabel: t('adm.user.removePhoto'), tone: 'red',
    onConfirm: ({ reason }) => adminApi.removePhoto(photoId, reason), onDone: done(t('adm.common.saved')) });

  return (
    <AdminPage title={name} sub={u.email} right={<>
      <Act label={t('adm.user.back')} tone="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/users' as never))} />
      <Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />
    </>}>
      <AdminUserAnalytics userId={String(id)} />
      <IdentityCorrection userId={String(id)} onSaved={reload} />
      {dialog}
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Badge label={t(STATUS_LABEL[u.status])} tone={STATUS_TONE[u.status]} />
        <Badge label={t(VERIF_LABEL[p.verification_status])} tone={p.verification_status === 'approved' ? 'green' : p.verification_status === 'pending' ? 'amber' : 'plain'} />
        {u.is_demo ? <Badge label={t('adm.users.demo')} tone="red" /> : null}
        {u.is_admin ? <Badge label={t('adm.users.admin')} tone="ink" /> : null}
        {!p.onboarding_done ? <Badge label={t('adm.users.draft')} /> : null}
        {p.paused ? <Badge label={t('adm.user.paused')} /> : null}
      </View>
      {u.status !== 'active' ? <Text style={{ fontSize: 12, color: colors.redDark, marginBottom: 10 }}>{t('adm.user.restrictedUntil', { date: fmtDate(p.suspended_until) })}</Text> : null}

      <Section title={t('adm.user.actions')}>
        <Acts>
          <Act label={t('adm.user.warn')} onPress={warn} />
          <Act label={t('adm.user.suspend')} tone="amber" onPress={suspend} disabled={u.is_admin} />
          <Act label={t('adm.user.ban')} tone="red" onPress={ban} disabled={u.is_admin || u.status === 'banned'} />
          {u.status !== 'active' ? <Act label={t('adm.user.liftAll')} tone="green" onPress={liftAll} /> : null}
          {p.verification_status !== 'approved' ? <Act label={t('adm.verify.approve')} tone="green" onPress={approve} /> : null}
          {p.verification_status === 'pending' ? <Act label={t('adm.verify.reject')} tone="red" onPress={reject} /> : null}
          {p.verification_status === 'approved' ? <Act label={t('adm.user.revoke')} tone="ghost" onPress={revoke} /> : null}
        </Acts>
        {u.is_admin ? <Text style={[muted, { marginTop: 8 }]}>{t('adm.user.adminNote')}</Text> : null}
      </Section>

      <Columns>
        <View>
          <Section title={t('adm.user.profile')}>
            <KV k="ID" v={p.id} />
            <KV k={t('adm.user.countryCity')} v={`${p.country}${p.city ? ` · ${p.city}` : ''}`} />
            <KV k={t('adm.user.gender')} v={`${p.gender ?? '—'} → ${p.seeking ?? '—'} · ${p.intent ?? '—'}`} />
            <KV k={t('adm.user.language')} v={p.language ?? '—'} />
            <KV k={t('adm.user.bio')} v={p.bio || '—'} />
            <KV k={t('adm.user.interests')} v={(p.interests ?? []).join(', ') || '—'} />
            <KV k={t('adm.user.created')} v={fmtDate(p.created_at)} />
            <KV k={t('adm.user.lastActive')} v={fmtDate(u.last_active)} />
            <KV k={t('adm.user.lastSignIn')} v={fmtDate(u.last_sign_in_at)} />
            <KV k={t('adm.user.incognito')} v={p.incognito ? t('adm.common.yes') : t('adm.common.no')} />
          </Section>
          <Section title={t('adm.user.photos', { n: u.photos.length })}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {u.photos.map((ph) => (
                <View key={ph.id} style={{ gap: 4 }}>
                  <AdminPhoto path={ph.kind === 'photo' ? ph.storage_path : null} label={`#${ph.position + 1}${ph.verified ? ' ✓' : ''}${ph.kind === 'video' ? ' · video' : ''}`} />
                  <Act label={t('adm.user.removePhoto')} tone="ghost" onPress={() => removePhoto(ph.id)} />
                </View>
              ))}
              {u.photos.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : null}
            </View>
          </Section>
          <Section title={t('adm.user.prompts')}>
            {u.prompts.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : u.prompts.map((q) => (
              <Line key={q.id}><Text style={muted}>{promptLabel(t, q.question_key)}</Text><Text style={small} selectable>{q.answer}</Text></Line>
            ))}
          </Section>
          <Section title={t('adm.user.verificationRequests')}>
            {u.verification_requests.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {u.verification_requests.map((v) => (
                  <View key={v.id} style={{ width: 120 }}>
                    <AdminPhoto path={v.storage_path} label={`${v.status} · ${fmtDate(v.created_at)}`} />
                    {v.decision_reason ? <Text style={muted}>{v.decision_reason}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </Section>
        </View>
        <View>
          <Section title={t('adm.user.activity')}>
            <KV k={t('adm.user.matches')} v={t('adm.user.matchesValue', { active: u.stats.matches_active, total: u.stats.matches_total })} />
            <KV k={t('adm.user.sparks')} v={t('adm.user.sparksValue', { sent: u.stats.sparks_sent, received: u.stats.sparks_received })} />
            <KV k={t('adm.user.messages')} v={u.stats.messages_sent} />
            <KV k={t('adm.user.blockedBy')} v={u.stats.blocked_by} />
          </Section>
          <Section title={t('adm.user.sanctions', { n: u.sanctions.length })}>
            {u.sanctions.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : u.sanctions.map((s) => (
              <Line key={s.id}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge label={t(KIND_LABEL[s.kind])} tone={s.kind === 'ban' ? 'red' : s.kind === 'suspension' ? 'amber' : 'plain'} />
                  {s.active ? <Badge label={t('adm.user.activeNow')} tone="red" /> : s.lifted_at ? <Badge label={t('adm.user.lifted')} tone="green" /> : null}
                  <Text style={muted}>{fmtDate(s.created_at)}{s.until ? ` → ${fmtDate(s.until)}` : ''}{s.created_by_email ? ` · ${s.created_by_email}` : ''}</Text>
                </View>
                <Text style={small} selectable>{s.reason}{s.note ? ` — ${s.note}` : ''}</Text>
                {s.lifted_at ? <Text style={muted}>{t('adm.user.liftedInfo', { date: fmtDate(s.lifted_at), by: s.lifted_by_email ?? '—', reason: s.lift_reason ?? '—' })}</Text> : null}
                {s.active ? <View style={{ marginTop: 4 }}><Act label={t('adm.user.lift')} tone="green" onPress={() => liftOne(s)} /></View> : null}
              </Line>
            ))}
          </Section>
          <Section title={t('adm.user.reportsAgainst', { n: u.reports_against.length })}
            right={u.reports_against.length ? <Act label={t('adm.user.openQueue')} tone="ghost" onPress={() => router.push({ pathname: '/admin/reports', params: { target: p.id } } as never)} /> : undefined}>
            {u.reports_against.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : u.reports_against.map((r) => (
              <Line key={r.id}>
                <Text style={small}><Text style={{ fontWeight: '700' }}>{REASON_LABEL[r.reason] ? t(REASON_LABEL[r.reason]) : r.reason}</Text> · {r.status === 'open' ? t('adm.reports.stateOpen') : t(OUTCOME_LABEL[r.decision ?? r.status] ?? 'adm.outcome.dismissed')} · {fmtDate(r.created_at)}</Text>
                {r.details ? <Text style={muted} selectable>{r.details}</Text> : null}
                {r.message_snapshot ? <Text style={[muted, { fontStyle: 'italic' }]} selectable>«{r.message_snapshot}»</Text> : null}
                {r.resolution_note ? <Text style={muted}>{t('adm.reports.note')}: {r.resolution_note}</Text> : null}
                <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: r.reporter_id } } as never)}><Text style={[muted, { color: colors.redDark }]}>{t('adm.reports.from', { name: r.reporter_name ?? r.reporter_id.slice(0, 8) })}</Text></Pressable>
              </Line>
            ))}
          </Section>
          <Section title={t('adm.user.reportsBy', { n: u.reports_by.length })}>
            {u.reports_by.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : u.reports_by.map((r) => (
              <Line key={r.id}>
                <Text style={small}>{REASON_LABEL[r.reason] ? t(REASON_LABEL[r.reason]) : r.reason} · {r.status} · {fmtDate(r.created_at)}</Text>
                {r.target_profile_id ? <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: r.target_profile_id as string } } as never)}><Text style={[muted, { color: colors.redDark }]}>{t('adm.reports.against', { name: r.target_name ?? '—' })}</Text></Pressable> : null}
              </Line>
            ))}
          </Section>
          <Section title={t('adm.user.appeals', { n: u.appeals.length })}>
            {u.appeals.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : u.appeals.map((a) => (
              <Line key={a.id}>
                <Text style={small}>{a.status} · {fmtDate(a.created_at)}</Text>
                <Text style={muted} selectable>{a.details}</Text>
                {a.decision_reason ? <Text style={muted}>{t('adm.appeals.decision')}: {a.decision_reason}</Text> : null}
              </Line>
            ))}
          </Section>
          <Section title={t('adm.user.history')}
            right={<Act label={t('adm.user.fullLog')} tone="ghost" onPress={() => router.push({ pathname: '/admin/audit', params: { target: p.id } } as never)} />}>
            {u.admin_actions.length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : u.admin_actions.map((a) => (
              <Line key={a.id}>
                <Text style={small}><Text style={{ fontWeight: '700' }}>{a.action}</Text> · {fmtDate(a.created_at)} · {a.admin_email ?? '—'}</Text>
                {a.reason ? <Text style={muted} selectable>{a.reason}</Text> : null}
              </Line>
            ))}
          </Section>
        </View>
      </Columns>
    </AdminPage>
  );
}
