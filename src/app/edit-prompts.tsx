import { useState } from 'react';
import { Text , View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, Eyebrow, Field, LinkBtn, Screen, Title, useToast } from '@/components/ui';
import { PromptPicker } from '@/components/PromptPicker';
import { PROMPTS } from '@/lib/catalog';
import { useMyPrompts, type MyPrompt } from '@/hooks/usePrompts';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { ErrorRetryState } from '@/components/States';

// 66 · Редактор ответов
export default function EditPrompts() {
  const { t } = useLang();
  const toast = useToast();
  const { items, saveAll, error, reload } = useMyPrompts();
  const [edited, setDraft] = useState<MyPrompt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const draft: MyPrompt[] = edited ?? items;
  const used = draft.map((d) => d.question_key);
  const add = () => {
    if (draft.length >= 3) { toast(t('screens.editPrompts.mozhnoDobavitDoTreh')); return; }
    const q = PROMPTS.find((p) => !used.includes(p));
    if (q) setDraft([...draft, { question_key: q, answer: '', position: draft.length }]);
  };
  const save = async () => {
    setBusy(true);
    try { await saveAll(draft); toast(t('screens.editPrompts.izmeneniyaSohraneny')); router.navigate('/me'); } catch { toast(t('screens.editPrompts.neUdalosSohranit')); } finally { setBusy(false); }
  };
  // Without the saved answers, "save" would replace them with whatever is on screen.
  if (error && !edited) return <Screen tabs="me"><BackLink /><ErrorRetryState onRetry={reload} /></Screen>;
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.editPrompts.voprosy')} heading={t('screens.editPrompts.pustRazgovorNachnetsya')} sub={t('screens.editPrompts.dobavteDo3Otvetov')} />
      {draft.map((d, i) => (
        <View key={i} style={{ backgroundColor: colors.blush, borderRadius: 17, padding: 18, marginVertical: 10 }}>
          <Eyebrow>{t('screens.editPrompts.vopros')}</Eyebrow>
          <PromptPicker value={d.question_key} exclude={used} onChange={(q) => setDraft(draft.map((x, j) => (j === i ? { ...x, question_key: q } : x)))} />
          <Field value={d.answer} onChangeText={(a) => setDraft(draft.map((x, j) => (j === i ? { ...x, answer: a } : x)))} multiline maxLength={300} style={{ minHeight: 70, textAlignVertical: 'top' }} />
          <LinkBtn label={t('screens.editPrompts.udalitOtvet')} onPress={() => { setDraft(draft.filter((_, j) => j !== i)); toast(t('screens.editPrompts.otvetUdalen')); }} />
        </View>
      ))}
      <Choice onPress={add}><Text style={{ fontSize: 12 }}>{t('screens.editPrompts.dobavitVopros')}</Text><Text style={{ fontSize: 10, color: colors.sub }}>{t('screens.editPrompts.do3')}</Text></Choice>
      <Btn label={t('screens.editPrompts.sohranitOtvety')} busy={busy} onPress={save} />
    </Screen>
  );
}
