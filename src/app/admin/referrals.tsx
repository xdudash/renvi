import { AdminPage, Act, Acts, Busy, ErrorNote, Tbl, errText, fmtDate, useActionDialog } from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { AdminError } from '@/lib/adminApi';

type Rf = { invited_user: string; code: string; status: string; created_at: string; owner_name: string | null };

// Referrals: a verified invite waits for a manual decision. Approving only marks it counted (no promo days, RENVI is free).
export default function AdminReferrals() {
  const { t } = useLang();
  const toast = useToast();
  const [dialog, openDialog] = useActionDialog();
  const { data, error, loading, reload } = useAsync(async () => {
    const { data: d, error: e } = await supabase.rpc('admin_referrals');
    if (e) throw new AdminError(e.message, e.code);
    return d as Rf[];
  }, []);
  const decide = (r: Rf, approve: boolean) => openDialog({
    title: approve ? t('adm.ref.approveTitle', { code: r.code }) : t('adm.ref.rejectTitle', { code: r.code }),
    body: approve ? t('adm.ref.approveBody') : undefined,
    confirmLabel: approve ? t('screens.adminReferrals.nachislit') : t('screens.adminReferrals.otklonit'),
    tone: approve ? 'green' : 'red', reason: 'none',
    onConfirm: async () => {
      const { error: e } = await supabase.rpc('admin_decide_referral', { p_invited: r.invited_user, p_approve: approve });
      if (e) throw new Error(e.message);
    },
    onDone: () => { toast(approve ? t('screens.adminReferrals.nagradaNachislena') : t('screens.adminReferrals.otkloneno')); reload(); },
  });
  return (
    <AdminPage title={t('screens.adminReferrals.referaly')} sub={t('adm.ref.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={reload} />}>
      {dialog}
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      {loading && !data ? <Busy /> : null}
      {data ? (
        <Tbl widths={[130, 110, 170, 110, 220]} head={[t('screens.adminReferrals.kogda'), t('screens.adminReferrals.kod'), t('screens.adminReferrals.priglasil'), t('screens.adminReferrals.status'), t('screens.adminReferrals.nagrada')]} rows={data.map((r) => [
          fmtDate(r.created_at), r.code, r.owner_name ?? '—', r.status,
          r.status === 'verified' ? <Acts key="act"><Act label={t('screens.adminReferrals.nachislit')} tone="green" onPress={() => decide(r, true)} /><Act label={t('screens.adminReferrals.otklonit')} tone="red" onPress={() => decide(r, false)} /></Acts> : '—',
        ])} />
      ) : null}
    </AdminPage>
  );
}
