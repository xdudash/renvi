import { Screen } from '@/components/ui';
import { EmptyChats } from '@/components/EmptyChats';

// 41 · Пустой список
export default function EmptyChatsScreen() {
  return <Screen tabs="chats"><EmptyChats /></Screen>;
}
