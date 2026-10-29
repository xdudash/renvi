import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminPage, AdminPhoto, Act, Acts, Badge, Busy, ErrorNote, FilterGroup, Pager, errText, fmtDate, useActionDialog, useWide } from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type VerificationRow } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const LIMIT = 20;
type St = 'pending' | 'approved' | 'rejected';
const muted = { fontSize: 11, color: colors.sub } as const;

// Manual selfie check: the selfie side by side with every profile photo; approve, or reject with a reason the user sees.
export default function AdminVerification() {
  const { t } = useLang();
  const toast = useToast();
  const wide = useWide();
  const [status, setStatus] = useState<St | null>('pending');
  const [offset, setOffset] = useState(0);
  const [dialog, openDialog] = useActionDialog();
  const { data, error, loading, reload } = useAsync(() => adminApi.verifications(status, LIMIT, offset), [status, offset]);

  const approve = (v: VerificationRow) => openDialog({
    title: t('adm.user.approveTitle', { name: v.name ?? '—' }), body: t('adm.verify.approveBody'), confirmLabel: t('adm.verify.approve'), tone: 'green', reason: 'optional',
    onConfirm: ({ reason }) => adminApi.verify(v.user_id, 'approved', reason || undefined),
    onDone: () => { toast(t('adm.verify.approvedToast')); reload(); },
  });
  const reject = (v: VerificationRow) => openDialog({
    title: t('adm.user.rejectTitle', { name: v.name ?? '—' }), body: t('adm.verify.reasonVisible'), confirmLabel: t('adm.verify.reject'), tone: 'red',
    presets: [t('adm.verify.presetFace'), t('adm.verify.presetMismatch'), t('adm.verify.presetQuality')],
    onConfirm: ({ reason }) => adminApi.verify(v.user_id, 'rejected', reason),
    onDone: () => { toast(t('adm.verify.rejectedToast')); reload(); },
  });

  const size = wide ? { w: 200, h: 250 } : { w: 140, h: 175 };
  return (
    <AdminPage title={t('adm.verify.title')} sub={t('adm.verify.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      {dialog}
      <FilterGroup<St> label={t('adm.verify.fStatus')} value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[
        { key: 'pending', label: t('adm.verif.pending') }, { key: 'approved', label: t('adm.verif.approved') },
        { key: 'rejected', label: t('adm.verif.rejected') }, { key: null, label: t('adm.common.all') }]} />
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
          {data.rows.length === 0 ? <Text style={[muted, { paddingVertical: 16 }]}>{t('adm.verify.empty')}</Text> : null}
          {data.rows.map((v) => (
            <View key={v.id} style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: v.user_id } } as never)}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.redDark }}>{v.name ?? '—'}{v.age ? `, ${v.age}` : ''}</Text>
                </Pressable>
                <Text style={muted}>{v.country ?? ''}{v.city ? ` · ${v.city}` : ''} · {fmtDate(v.created_at)}</Text>
                <Badge label={v.status} tone={v.status === 'approved' ? 'green' : v.status === 'rejected' ? 'red' : 'amber'} />
                {v.previous_requests > 0 ? <Badge label={t('adm.verify.previous', { n: v.previous_requests })} /> : null}
              </View>
              <ScrollView horizontal>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={{ borderRightWidth: 2, borderRightColor: colors.red, paddingRight: 12 }}>
                    <AdminPhoto path={v.storage_path} w={size.w} h={size.h} label={t('adm.verify.selfie')} />
                  </View>
                  {v.photos.map((p, i) => <AdminPhoto key={p} path={p} w={size.w} h={size.h} label={t('adm.verify.photoN', { n: i + 1 })} />)}
                  {v.photos.length === 0 ? <Text style={muted}>{t('adm.verify.noPhotos')}</Text> : null}
                </View>
              </ScrollView>
              {v.decision_reason ? <Text style={{ fontSize: 12, marginTop: 8, color: colors.ink }}>{t('adm.verify.reasonShown')}: {v.decision_reason}</Text> : null}
              {v.status === 'pending' ? (
                <View style={{ marginTop: 10 }}>
                  <Acts>
                    <Act label={t('adm.verify.approve')} tone="green" onPress={() => approve(v)} disabled={v.photos.length === 0} />
                    <Act label={t('adm.verify.reject')} tone="red" onPress={() => reject(v)} />
                  </Acts>
                </View>
              ) : null}
            </View>
          ))}
          <Pager total={data.total} offset={offset} limit={LIMIT} onChange={setOffset} />
        </View>
      ) : null}
    </AdminPage>
  );
}
