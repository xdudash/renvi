import { useState } from 'react';
import { Text } from 'react-native';
import { Choice, Sheet } from './ui';
import { PROMPTS, promptLabel } from '@/lib/catalog';
import { useLang } from '@/lib/lang';

export function PromptPicker({ value, onChange, exclude = [] }: { value: string; onChange: (q: string) => void; exclude?: string[] }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Choice selected onPress={() => setOpen(true)}>
        <Text style={{ fontSize: 12, flex: 1 }}>{promptLabel(t, value)}</Text><Text>⌄</Text>
      </Choice>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        {PROMPTS.filter((q) => q === value || !exclude.includes(q)).map((q) => (
          <Choice key={q} selected={q === value} onPress={() => { onChange(q); setOpen(false); }}>
            <Text style={{ fontSize: 12 }}>{promptLabel(t, q)}</Text><Text>{q === value ? '✓' : '›'}</Text>
          </Choice>
        ))}
      </Sheet>
    </>
  );
}
