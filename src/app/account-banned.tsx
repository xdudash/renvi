import { router } from 'expo-router';
import { Btn, Screen, StateBlock } from '@/components/ui';

// 94 · Аккаунт заблокирован
export default function AccountBanned() {
  return (
    <Screen>
      <StateBlock icon="×" title="Аккаунт заблокирован" copy="Здесь будут причина, дата решения и ссылка на обжалование. Не прячем решение за обращением в поддержку." label="Подать апелляцию" onPress={() => router.push('/appeal')} />
      <Btn kind="ghost" label="Скачать копию данных" onPress={() => router.push('/data-export')} />
    </Screen>
  );
}
