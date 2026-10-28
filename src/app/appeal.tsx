import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Field, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// 88 · Обжаловать решение
export default function Appeal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (text.trim().length < 5) { toast('Коротко опишите причину пересмотра'); return; }
    setBusy(true);
    try {
      let reportId = id;
      if (!reportId) {
        // Appeal of an account restriction: attach to the latest decision about this account.
        const { data } = await supabase.from('account_sanctions').select('reason').order('created_at', { ascending: false }).limit(1);
        const ref = data?.[0]?.reason?.replace('report ', '');
        reportId = ref && /^[0-9a-f-]{36}$/.test(ref) ? ref : undefined;
      }
      if (reportId) await api.appeal(reportId, text.trim());
      else await api.support('appeal', text.trim(), false);
      toast('Апелляция зарегистрирована');
      router.replace(reportId ? { pathname: '/report-status', params: { id: reportId } } : '/support-help');
    } catch { toast('Не удалось отправить апелляцию'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="АПЕЛЛЯЦИЯ" heading="Попросить пересмотр" sub="Коротко объясните, с каким пунктом решения вы не согласны." />
      <Field value={text} onChangeText={setText} multiline maxLength={1000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Опишите причину пересмотра" />
      <Btn label="Отправить апелляцию" busy={busy} onPress={submit} />
      <Btn kind="ghost" label="Назад к решению" onPress={() => router.back()} />
    </Screen>
  );
}
