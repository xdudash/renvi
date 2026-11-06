import { router } from 'expo-router';
import { Btn, StateBlock } from '@/components/ui';
import type { Modes } from '@/lib/api';
import { openDate, statusTitleKey } from '@/lib/modes';
import { useLang } from '@/lib/lang';

/** Why a mode is closed (people-locked): dating needs the status «Свободен»; couples need a linked couple profile. */
export function LockedMode({ mode, modes }: { mode: 'dating' | 'couples'; modes: Modes | null | undefined }) {
  const { t } = useLang();
  const couples = mode === 'couples';
  const waiting = !couples && modes?.status === 'single' && !!modes.dating_open_at;
  const status = modes ? t(statusTitleKey(modes.status === 'single' ? 'married' : modes.status)) : '';
  const copy = couples
    ? t('modes.locked.couplesP')
    : waiting ? t('modes.locked.datingWait', { date: openDate(modes?.dating_open_at) }) : t('modes.locked.datingP', { status });
  return (
    <StateBlock icon="🔒" title={couples ? t('modes.locked.couples') : t('modes.locked.dating')} copy={copy}
      label={couples ? t('modes.locked.link') : t('modes.locked.status')}
      onPress={() => router.push((couples ? '/ob-pair' : '/status-change') as never)}
      secondary={couples ? <Btn kind="ghost" label={t('modes.locked.status')} onPress={() => router.push('/status-change')} /> : undefined} />
  );
}
