import { Linking } from 'react-native';
import { BackLink, Card, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';

const DOCS: [string, string, string][] = [
  ['privacy', 'Политика приватности', 'Как используются данные'],
  ['terms', 'Условия использования', 'Права и обязанности'],
  ['community', 'Правила сообщества', 'Уважение и безопасность'],
  ['subscriptions', 'Подписки и возвраты', 'Управление покупкой Apple'],
  ['moderation', 'Решения модерации', 'Статус и апелляция'],
];

// 74 · Правила и документы
export default function Legal() {
  const toast = useToast();
  const { data } = useAsync(() => api.config<Record<string, string | null>>('legal_urls'), []);
  const open = (key: string, name: string) => {
    const url = data?.[key];
    if (!url) { toast(`Документ «${name}» ещё не опубликован`); return; }
    Linking.openURL(url).catch(() => toast('Не удалось открыть документ'));
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="ДОКУМЕНТЫ" heading="Правила и прозрачность" sub="Просмотрите актуальные документы для вашей страны и языка." />
      <Card tight>{DOCS.map(([k, a, b]) => <Row key={k} label={a} sub={b} right="↗" onPress={() => open(k, a)} />)}</Card>
      <Tiny>Документы должны быть проверены для конкретных рынков ЕС перед запуском.</Tiny>
    </Screen>
  );
}
