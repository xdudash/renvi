import { router } from 'expo-router';
import { BackLink, Card, Eyebrow, Screen, Tiny, Title } from '@/components/ui';
import { Row } from '@/components/Row';

// 71 · Приватность и данные
export default function PrivacyData() {
  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker="ПРИВАТНОСТЬ" heading="Данные под вашим контролем" sub="Показываем понятные настройки без скрытых согласий." />
      <Card tight>
        <Eyebrow>ВАШИ ВЫБОРЫ</Eyebrow>
        <Row label="Видимость анкеты" sub="Пауза · активность · инкогнито" onPress={() => router.push('/privacy-visibility')} />
        <Row label="Геолокация" sub="Город · примерное расстояние" onPress={() => router.push('/location-permission')} />
        <Row label="Заблокированные профили" onPress={() => router.push('/blocked')} />
      </Card>
      <Card tight>
        <Eyebrow>ВАШИ ДАННЫЕ</Eyebrow>
        <Row label="Получить копию данных" sub="Запросить файл в переносимом формате" onPress={() => router.push('/data-export')} />
        <Row label="Удалить аккаунт" sub="Удаление без повторного предложения подписки" onPress={() => router.push('/delete-account')} />
        <Row label="Согласия и документы" onPress={() => router.push('/legal')} />
      </Card>
      <Tiny>Собираем только данные, необходимые для работы выбранных функций. Дизайн экрана не заменяет юридическую проверку политики и оснований обработки.</Tiny>
    </Screen>
  );
}
