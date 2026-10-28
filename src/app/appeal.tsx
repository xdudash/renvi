import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Field, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';

// 88 · Обжаловать решение
export default function Appeal() {
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (text.trim().length < 5) { toast(t('screens.appeal.korotkoOpishitePrichinuPer')); return; }
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
      toast(t('screens.appeal.apellyatsiyaZaregistrirova'));
      router.replace(reportId ? { pathname: '/report-status', params: { id: reportId } } : '/support-help');
    } catch { toast(t('screens.appeal.neUdalosOtpravitApellyatsi')); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.appeal.apellyatsiya')} heading={t('screens.appeal.poprositPeresmotr')} sub={t('screens.appeal.korotkoObyasniteSKakim')} />
      <Field value={text} onChangeText={setText} multiline maxLength={1000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.appeal.opishitePrichinuPeresmotra')} />
      <Btn label={t('screens.appeal.otpravitApellyatsiyu')} busy={busy} onPress={submit} />
      <Btn kind="ghost" label={t('screens.appeal.nazadKResheniyu')} onPress={() => router.back()} />
    </Screen>
  );
}
