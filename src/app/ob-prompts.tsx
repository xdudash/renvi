import { useState } from 'react';
import { Text } from 'react-native';
import { Btn, Choice, Field, Screen, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { PromptPicker } from '@/components/PromptPicker';
import { PROMPTS } from '@/lib/catalog';
import { useMyPrompts, type MyPrompt } from '@/hooks/usePrompts';

// 17 · Вопросы-подсказки
export default function ObPrompts() {
  const toast = useToast();
  const { items, saveAll } = useMyPrompts();
  const [edited, setDraft] = useState<MyPrompt[] | null>(null);
  const { save, busy } = useStepSave('ob-prompts');
  const draft: MyPrompt[] = edited ?? (items.length ? items : [{ question_key: PROMPTS[0], answer: '', position: 0 }]);
  const used = draft.map((d) => d.question_key);
  const addOne = () => {
    if (draft.length >= 3) { toast('Можно выбрать до трёх вопросов'); return; }
    const q = PROMPTS.find((p) => !used.includes(p));
    if (q) setDraft([...draft, { question_key: q, answer: '', position: draft.length }]);
  };
  const submit = async () => {
    try { await saveAll(draft); await save({}); } catch { toast('Не удалось сохранить ответы'); }
  };
  return (
    <Screen>
      <OnbHeader step={7} kicker="ВАШ ГОЛОС" heading="Ответьте на один вопрос" sub="Не обязательно для публикации, но конкретный ответ упрощает первый шаг. Можно выбрать до трёх." />
      {draft.map((d, i) => (
        <PromptBlock key={i} item={d} exclude={used} onChange={(n) => setDraft(draft.map((x, j) => (j === i ? n : x)))} />
      ))}
      <Choice onPress={addOne}><Text style={{ fontSize: 12 }}>＋ Добавить ещё один вопрос</Text></Choice>
      <Btn label="Сохранить ответы" busy={busy} onPress={submit} />
      <Btn kind="ghost" label="Пропустить" onPress={() => save({})} />
    </Screen>
  );
}

function PromptBlock({ item, exclude, onChange }: { item: MyPrompt; exclude: string[]; onChange: (n: MyPrompt) => void }) {
  return (
    <>
      <PromptPicker value={item.question_key} exclude={exclude} onChange={(q) => onChange({ ...item, question_key: q })} />
      <Field value={item.answer} onChangeText={(a) => onChange({ ...item, answer: a })} multiline maxLength={300} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="…кофе, прогулка и разговор, который не заметили по времени." />
    </>
  );
}
