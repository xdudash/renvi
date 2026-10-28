import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, CheckRow, Field, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';

// 54 · Поддержка · поделиться чатом
export default function SupportShare() {
  const { match } = useLocalSearchParams<{ match?: string }>();
  const toast = useToast();
  const [text, setText] = useState('');
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (withHistory: boolean) => {
    if (text.trim().length < 5) { toast('Опишите проблему хотя бы парой слов'); return; }
    setBusy(true);
    try {
      await api.supportChat(match ?? null, text.trim(), withHistory && !!match);
      toast('Обращение отправлено');
      router.replace('/safety');
    } catch { toast('Не удалось отправить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ОБРАЩЕНИЕ В ПОДДЕРЖКУ" heading="Что пошло не так?" sub="Можно добровольно приложить до 50 последних сообщений этого диалога." />
      <Field value={text} onChangeText={setText} multiline maxLength={2000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Опишите проблему без платёжных или личных данных" />
      {match ? (
        <CheckRow on={history} onPress={() => setHistory(!history)}><Text style={{ fontSize: 12 }}>Приложить историю диалога</Text></CheckRow>
      ) : null}
      <Tiny>Вы увидите, что именно будет отправлено, до подтверждения.</Tiny>
      <Btn label="Продолжить" busy={busy} onPress={() => submit(history)} />
      <Btn kind="ghost" label="Без истории сообщений" disabled={busy} onPress={() => submit(false)} />
    </Screen>
  );
}
