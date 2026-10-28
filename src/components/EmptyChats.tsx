import { router } from 'expo-router';
import { StateBlock } from './ui';
import { useLang } from '@/lib/lang';

export function EmptyChats() {
  const { t } = useLang();
  return <StateBlock icon="▤" title={t('components.emptyChats.title')} copy={t('components.emptyChats.copy')} label={t('components.emptyChats.label')} onPress={() => router.navigate('/discover')} />;
}
