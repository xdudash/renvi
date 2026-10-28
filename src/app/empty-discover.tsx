import { BackLink, Screen } from '@/components/ui';
import { EmptyDiscover } from '@/components/States';

// 30 · Пустая подборка
export default function EmptyDiscoverScreen() {
  return <Screen tabs="discover"><BackLink /><EmptyDiscover /></Screen>;
}
