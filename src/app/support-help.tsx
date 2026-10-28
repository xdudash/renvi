import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Field, Screen, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const TOPICS: [string, string][] = [['Безопасные встречи', '/safety'], ['Вход и пароль', '/signin'], ['Покупки и подписка', '/plans'], ['Данные и приватность', '/privacy-data'], ['Проблема с сообщениями', '/support-share']];

// 72 · Поддержка
export default function SupportHelp() {
  const toast = useToast();
  const { session } = useSession();
  const [q, setQ] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => TOPICS.filter(([t]) => t.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const send = async () => {
    if (!session) { router.push('/signin'); return; }
    if (body.trim().length < 5) { toast('Опишите вопрос хотя бы парой слов'); return; }
    setBusy(true);
    try { await api.support('help', body.trim(), false); setBody(''); toast('Запрос отправлен. Ответ придёт на почту.'); }
    catch { toast('Не удалось отправить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs={session ? 'me' : undefined}>
      <BackLink />
      <Title kicker="ПОМОЩЬ" heading="Как можем помочь?" sub="Выберите тему или отправьте обращение." />
      <Field value={q} onChangeText={setQ} placeholder="Найти ответ" accessibilityLabel="Найти ответ" />
      <Card tight>{list.map(([t, r]) => <Row key={t} label={t} onPress={() => router.push(r as never)} />)}</Card>
      <Field value={body} onChangeText={setBody} multiline maxLength={2000} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Опишите вопрос" />
      <Btn label="Отправить запрос" busy={busy} onPress={send} />
    </Screen>
  );
}
