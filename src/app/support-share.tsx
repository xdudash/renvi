import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, CheckRow, Field, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';

// 54 · Поддержка · поделиться чатом
export default function SupportShare() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match?: string }>();
  const toast = useToast();
  const [text, setText] = useState('');
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (withHistory: boolean) => {
    if (text.trim().length < 5) { toast(t('screens.supportShare.opishiteProblemuHotyaBy')); return; }
    setBusy(true);
    try {
      await api.supportChat(match ?? null, text.trim(), withHistory && !!match);
      toast(t('screens.supportShare.obraschenieOtpravleno'));
      router.replace('/safety');
    } catch { toast(t('screens.supportShare.neUdalosOtpravit')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.supportShare.obraschenieVPodderzhku')} heading={t('screens.supportShare.chtoPoshloNeTak')} sub={t('screens.supportShare.mozhnoDobrovolnoPrilozhitD')} />
      <Field value={text} onChangeText={setText} multiline maxLength={2000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.supportShare.opishiteProblemuBezPlatezh')} />
      {match ? (
        <CheckRow on={history} onPress={() => setHistory(!history)}><Text style={{ fontSize: 12 }}>{t('screens.supportShare.prilozhitIstoriyuDialoga')}</Text></CheckRow>
      ) : null}
      <Tiny>{t('screens.supportShare.vyUviditeChtoImenno')}</Tiny>
      <Btn label={t('screens.supportShare.prodolzhit')} busy={busy} onPress={() => submit(history)} />
      <Btn kind="ghost" label={t('screens.supportShare.bezIstoriiSoobscheniy')} disabled={busy} onPress={() => submit(false)} />
    </Screen>
  );
}
