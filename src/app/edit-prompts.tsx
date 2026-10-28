import { useState } from 'react';
import { Text , View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, Eyebrow, Field, LinkBtn, Screen, Title, useToast } from '@/components/ui';
import { PromptPicker } from '@/components/PromptPicker';
import { PROMPTS } from '@/lib/catalog';
import { useMyPrompts, type MyPrompt } from '@/hooks/usePrompts';
import { colors } from '@/theme/tokens';

// 66 · Редактор ответов
export default function EditPrompts() {
  const toast = useToast();
  const { items, saveAll } = useMyPrompts();
  const [edited, setDraft] = useState<MyPrompt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const draft: MyPrompt[] = edited ?? items;
  const used = draft.map((d) => d.question_key);
  const add = () => {
    if (draft.length >= 3) { toast('Можно добавить до трёх ответов'); return; }
    const q = PROMPTS.find((p) => !used.includes(p));
    if (q) setDraft([...draft, { question_key: q, answer: '', position: draft.length }]);
  };
  const save = async () => {
    setBusy(true);
    try { await saveAll(draft); toast('Изменения сохранены'); router.navigate('/me'); } catch { toast('Не удалось сохранить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="ВОПРОСЫ" heading="Пусть разговор начнётся" sub="Добавьте до 3 ответов. Каждый можно прокомментировать искрой." />
      {draft.map((d, i) => (
        <View key={i} style={{ backgroundColor: colors.blush, borderRadius: 17, padding: 18, marginVertical: 10 }}>
          <Eyebrow>ВОПРОС</Eyebrow>
          <PromptPicker value={d.question_key} exclude={used} onChange={(q) => setDraft(draft.map((x, j) => (j === i ? { ...x, question_key: q } : x)))} />
          <Field value={d.answer} onChangeText={(a) => setDraft(draft.map((x, j) => (j === i ? { ...x, answer: a } : x)))} multiline maxLength={300} style={{ minHeight: 70, textAlignVertical: 'top' }} />
          <LinkBtn label="Удалить ответ" onPress={() => { setDraft(draft.filter((_, j) => j !== i)); toast('Ответ удалён'); }} />
        </View>
      ))}
      <Choice onPress={add}><Text style={{ fontSize: 12 }}>＋ Добавить вопрос</Text><Text style={{ fontSize: 10, color: colors.sub }}>до 3</Text></Choice>
      <Btn label="Сохранить ответы" busy={busy} onPress={save} />
    </Screen>
  );
}
