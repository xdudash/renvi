import { router } from 'expo-router';
import { Btn, Screen, StateBlock } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';

// 20 · Проверка вручную
export default function ObReview() {
  const { save, busy } = useStepSave('ob-review');
  return (
    <Screen>
      <OnbHeader step={10} kicker="ПРОВЕРКА" heading="Селфи отправлено" sub="Пока модератор проверяет фото, можно продолжить оформление профиля." />
      <StateBlock icon="◷" title="Обычно — несколько минут" copy="Мы покажем статус здесь и в профиле. До проверки можно спокойно настроить анкету." />
      <Btn label="Продолжить оформление" busy={busy} onPress={() => save({})} />
      <Btn kind="ghost" label="Что проверяется?" onPress={() => router.push('/safety')} />
    </Screen>
  );
}
