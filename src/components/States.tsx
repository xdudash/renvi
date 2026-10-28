import { router } from 'expo-router';
import { Btn, SafeBanner, StateBlock } from './ui';
import { useLang } from '@/lib/lang';

export function EmptyDiscover() {
  const { t } = useLang();
  return (
    <>
      <StateBlock icon="⌕" title={t('components.states.emptyTitle')} copy={t('components.states.emptyCopy')} label={t('components.states.changeFilters')} onPress={() => router.push('/filters')} />
      <SafeBanner>{t('components.states.approxLocation')}</SafeBanner>
    </>
  );
}
export function OfflineState({ onRetry }: { onRetry: () => void }) {
  const { t } = useLang();
  return (
    <>
      <StateBlock icon="⌁" title={t('components.states.offlineTitle')} copy={t('components.states.offlineCopy')} label={t('components.states.checkAgain')} onPress={onRetry} />
      <Btn kind="ghost" label={t('components.states.goBack')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))} />
    </>
  );
}
export function ErrorRetryState({ onRetry }: { onRetry: () => void }) {
  const { t } = useLang();
  return (
    <>
      <StateBlock icon="↻" title={t('common.loadFailed')} copy={t('components.states.errorCopy')} label={t('common.retry')} onPress={onRetry} />
      <Btn kind="ghost" label={t('components.states.contactSupport')} onPress={() => router.push('/support-share')} />
    </>
  );
}
export function LoadingState() {
  return null;
}
