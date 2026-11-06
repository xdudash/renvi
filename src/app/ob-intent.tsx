import { Btn, Screen } from '@/components/ui';
import { BigOption } from '@/components/Kit';
import type { IconName } from '@/components/UiIcon';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { INTENTS } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

const ICON: Record<string, IconName> = { serious: 'heart', casual: 'bolt', friends: 'people', unsure: 'bulb' };
const SUB = { serious: 'onbx.intent.serious.sub', casual: 'onbx.intent.casual.sub', unsure: 'onbx.intent.unsure.sub', friends: 'onbx.intent.friends.sub' } as const;

// 13 · Намерение
export default function ObIntent() {
  const { t } = useLang();
  const { profile } = useSession();
  const [v, setV] = useDraft<string>(profile?.intent ?? 'serious');
  const { save, busy } = useStepSave('ob-intent');
  return (
    <Screen>
      <OnbHeader step={5} kicker={t('onbx.intent.kicker')} heading={t('onbx.intent.h')} sub={t('onbx.intent.sub')} />
      {INTENTS.filter((i) => i.key !== 'friends' || profile?.intent === 'friends').map((i) => (
        <BigOption key={i.key} on={v === i.key} icon={ICON[i.key]} title={t(i.labelKey)} sub={t(SUB[i.key])} onPress={() => setV(i.key)} />
      ))}
      <Btn label={t('screens.obIntent.prodolzhit')} onPress={() => save({ intent: v })} busy={busy} />
    </Screen>
  );
}
