import { router } from 'expo-router';
import { StateBlock } from './ui';

export function EmptyChats() {
  return <StateBlock icon="▤" title="Здесь будут ваши диалоги" copy="Совпадение появится после взаимной искры. Чтобы легче начать, можно ответить на вопрос в анкете." label="Посмотреть анкеты" onPress={() => router.navigate('/discover')} />;
}
