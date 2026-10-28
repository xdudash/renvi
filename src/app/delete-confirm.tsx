import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, CheckRow, Choice, Eyebrow, Screen, Sheet, Title, useToast } from '@/components/ui';
import { deleteAccount } from '@/lib/account';
import { useSession } from '@/lib/session';
import { ruA } from '@/i18n/strings-a';
import { useLang } from '@/lib/lang';

const REASONS = ['screens.deleteConfirm.reasonNone', 'screens.deleteConfirm.reasonNoMatches', 'screens.deleteConfirm.reasonBreak', 'screens.deleteConfirm.reasonOther'] as const;

// 77 · Подтверждение удаления
export default function DeleteConfirm() {
  const { t } = useLang();
  const toast = useToast();
  const { refresh } = useSession();
  const [ok, setOk] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!ok) { toast(t('screens.deleteConfirm.confirmFirst')); return; }
    setBusy(true);
    try {
      await deleteAccount(reason === REASONS[0] ? null : ruA[reason]);
      await refresh();
      toast(t('screens.deleteConfirm.deleted'));
      router.replace('/');
    } catch { toast(t('screens.deleteConfirm.failed')); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.deleteConfirm.kicker')} heading={t('screens.deleteConfirm.heading')} sub={t('screens.deleteConfirm.sub')} />
      <CheckRow on={ok} onPress={() => setOk(!ok)}><Text style={{ fontSize: 12 }}>{t('screens.deleteConfirm.understand')}</Text></CheckRow>
      <Eyebrow style={{ marginTop: 10 }}>{t('screens.deleteConfirm.reasonEyebrow')}</Eyebrow>
      <Choice onPress={() => setOpen(true)}><Text style={{ fontSize: 12 }}>{t(reason)}</Text><Text>⌄</Text></Choice>
      <Btn kind="warn" label={t('screens.deleteConfirm.delete')} busy={busy} onPress={submit} />
      <Btn kind="ghost" label={t('screens.deleteConfirm.cancel')} onPress={() => router.navigate('/privacy-data')} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        {REASONS.map((r) => <Choice key={r} selected={r === reason} onPress={() => { setReason(r); setOpen(false); }}><Text style={{ fontSize: 12 }}>{t(r)}</Text><Text>{r === reason ? '✓' : ''}</Text></Choice>)}
      </Sheet>
    </Screen>
  );
}
