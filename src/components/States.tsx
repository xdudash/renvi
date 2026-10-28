import { router } from 'expo-router';
import { Btn, SafeBanner, StateBlock } from './ui';

export function EmptyDiscover() {
  return (
    <>
      <StateBlock icon="⌕" title="Пока рядом никого" copy="Увеличьте расстояние или попробуйте позже. Мы покажем только анкеты, которые подходят по вашим настройкам." label="Изменить фильтры" onPress={() => router.push('/filters')} />
      <SafeBanner>Локация остаётся приблизительной. Вы можете выбирать город без доступа к GPS.</SafeBanner>
    </>
  );
}
export function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <StateBlock icon="⌁" title="Похоже, нет интернета" copy="Уже просмотренные экраны останутся доступны. Сообщения можно будет повторить после подключения." label="Проверить снова" onPress={onRetry} />
      <Btn kind="ghost" label="Вернуться назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))} />
    </>
  );
}
export function ErrorRetryState({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <StateBlock icon="↻" title="Не удалось загрузить" copy="Проверьте соединение и повторите попытку. Ваши данные не потерялись." label="Повторить" onPress={onRetry} />
      <Btn kind="ghost" label="Связаться с поддержкой" onPress={() => router.push('/support-share')} />
    </>
  );
}
export function LoadingState() {
  return null;
}
