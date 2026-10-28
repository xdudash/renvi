import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';

// 89 · Правила сообщества
export default function CommunityRules() {
  return (
    <Screen>
      <BackLink />
      <Title kicker="ПРАВИЛА СООБЩЕСТВА" heading="Уважение — обязательное условие" sub="RENVI — пространство для взрослых людей, которые знакомятся с взаимным уважением." />
      <Card>
        <Text style={{ fontSize: 13, lineHeight: 20 }}>{'• Только 18+ и только собственные фото.\n\n• Согласие и личные границы важны в переписке и при встрече.\n\n• Запрещены угрозы, домогательства, шантаж, мошенничество и публикация чужих данных.\n\n• Не отправляйте деньги людям, с которыми познакомились онлайн.\n\n• На каждую жалобу можно получить ответ и при необходимости запросить пересмотр.'}</Text>
      </Card>
      <Btn label="Понятно" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
