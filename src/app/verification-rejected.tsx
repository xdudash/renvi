import { router } from 'expo-router';
import { BackLink, Btn, SafeBanner, Screen, Title } from '@/components/ui';

// 23 · Проверка · отклонена
export default function VerificationRejected() {
  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title kicker="ПРОВЕРКА ФОТО" heading="Нужно другое селфи" sub="Лицо должно быть хорошо видно, в кадре должен быть только один человек." />
      <SafeBanner>Фото профиля не меняется автоматически. Вы сами выбираете, какие изображения видны другим.</SafeBanner>
      <Btn label="Повторить проверку" onPress={() => router.push('/ob-verify')} />
      <Btn kind="ghost" label="Связаться с поддержкой" onPress={() => router.push('/support-help')} />
    </Screen>
  );
}
