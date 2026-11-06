import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Choice, Sheet } from './ui';
import { colors } from '@/theme/tokens';
import { PROMPTS, promptLabel } from '@/lib/catalog';
import { useLang } from '@/lib/lang';

export function PromptPicker({ value, onChange, exclude = [] }: { value: string; onChange: (q: string) => void; exclude?: string[] }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mockup: the question is the card headline (22/800); tapping it opens the list of questions. */}
      <Pressable accessibilityRole="button" accessibilityLabel={promptLabel(t, value)} onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 4 }}>
        <Text style={{ fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.ink, flex: 1 }}>{promptLabel(t, value)}</Text>
        <Text style={{ fontSize: 14, color: colors.sub }}>⌄</Text>
      </Pressable>
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
