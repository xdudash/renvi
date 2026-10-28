import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, CheckRow, Choice, Eyebrow, Screen, Sheet, Title, useToast } from '@/components/ui';
import { deleteAccount } from '@/lib/account';
import { useSession } from '@/lib/session';

const REASONS = ['Предпочитаю не указывать', 'Не нашёл подходящих людей', 'Хочу сделать перерыв', 'Другое'];

// 77 · Подтверждение удаления
export default function DeleteConfirm() {
  const toast = useToast();
  const { refresh } = useSession();
  const [ok, setOk] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!ok) { toast('Подтвердите, что понимаете, какие данные будут удалены'); return; }
    setBusy(true);
    try {
      await deleteAccount(reason === REASONS[0] ? null : reason);
      await refresh();
      toast('Аккаунт удалён');
      router.replace('/');
    } catch { toast('Не удалось удалить аккаунт. Повторите попытку.'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="ПОСЛЕДНИЙ ШАГ" heading="Подтвердите удаление" sub="Это действие необратимо после периода восстановления, если он предусмотрен политикой сервиса." />
      <CheckRow on={ok} onPress={() => setOk(!ok)}><Text style={{ fontSize: 12 }}>Я понимаю, какие данные будут удалены</Text></CheckRow>
      <Eyebrow style={{ marginTop: 10 }}>ПРИЧИНА · НЕОБЯЗАТЕЛЬНО</Eyebrow>
      <Choice onPress={() => setOpen(true)}><Text style={{ fontSize: 12 }}>{reason}</Text><Text>⌄</Text></Choice>
      <Btn kind="warn" label="Удалить аккаунт" busy={busy} onPress={submit} />
      <Btn kind="ghost" label="Отмена" onPress={() => router.navigate('/privacy-data')} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        {REASONS.map((r) => <Choice key={r} selected={r === reason} onPress={() => { setReason(r); setOpen(false); }}><Text style={{ fontSize: 12 }}>{r}</Text><Text>{r === reason ? '✓' : ''}</Text></Choice>)}
      </Sheet>
    </Screen>
  );
}
