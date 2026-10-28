import { router } from 'expo-router';
import { BackLink, Btn, Screen, StateBlock } from '@/components/ui';

// 32 · Лимит лайков
export default function LikeLimit() {
  return (
    <Screen tabs="discover">
      <BackLink />
      <StateBlock icon="♡" title="Лайки на сегодня закончились" copy="Лимит Free обновится завтра. Вы можете продолжать смотреть анкеты, писать совпадениям и менять фильтры." label="Посмотреть RENVI Plus" onPress={() => router.push('/plans')} />
      <Btn kind="ghost" label="Вернуться к знакомствам" onPress={() => router.navigate('/discover')} />
    </Screen>
  );
}
