import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Card, SafeBanner, Screen, Tiny, Title, useToast } from '@/components/ui';
import { Row } from '@/components/Row';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

// 85 · Центр безопасности
export default function Safety() {
  const { profile: target, match } = useLocalSearchParams<{ profile?: string; match?: string }>();
  const { session } = useSession();
  const toast = useToast();
  const block = async () => {
    if (!target) { router.push('/blocked'); return; }
    try { await api.block(target); toast('Профиль заблокирован'); router.replace('/blocked'); } catch { toast('Не удалось заблокировать'); }
  };
  return (
    <Screen tabs={session ? 'discover' : undefined}>
      <BackLink />
      <Title kicker="БЕЗОПАСНОСТЬ" heading="Вы управляете границами" sub="Не нужно объяснять отказ. Можно прекратить контакт в любой момент." />
      <SafeBanner>Для первой встречи: выбирайте публичное место, сообщите близкому, держите под контролем свой транспорт и не отправляйте деньги.</SafeBanner>
      <Card tight>
        <Row label="Заблокировать профиль" sub="Вы больше не увидите друг друга" onPress={block} />
        <Row label="Пожаловаться на профиль или контент" sub="Мы покажем ход рассмотрения" onPress={() => router.push({ pathname: '/report', params: { profile: target ?? '' } })} />
        <Row label="Сообщить о незаконном контенте" sub="Отдельный простой канал для заметки" onPress={() => router.push({ pathname: '/report', params: { profile: target ?? '', reason: 'illegal' } })} />
        <Row label="Отправить историю чата поддержке" sub="Только после вашего просмотра состава" onPress={() => router.push({ pathname: '/support-share', params: { match: match ?? '' } })} />
        <Row label="Правила сообщества" sub="Прозрачные правила и границы" onPress={() => router.push('/community-rules')} />
      </Card>
      <Tiny>Подтверждение фото помогает оценить профиль, но не гарантирует, что информация полностью достоверна.</Tiny>
    </Screen>
  );
}
