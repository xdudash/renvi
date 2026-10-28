import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Eyebrow, Field, Pill, Screen, Segmented, Title, useToast } from '@/components/ui';
import { DATE_TIMES, dayParts, getDateDraft, iso, setDateDraft, weekDays } from '@/lib/dateDraft';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

// 57 · Дата и время
export default function DateTime() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const d0 = getDateDraft();
  const [week, setWeek] = useState<'this' | 'next'>('this');
  const [day, setDay] = useState(d0.day);
  const [time, setTime] = useState(d0.time);
  const [note, setNote] = useState(d0.note);
  const [busy, setBusy] = useState(false);
  const days = weekDays(week);
  const send = async () => {
    if (!day) { toast('Выберите день'); return; }
    setDateDraft({ day, time, note });
    const d = getDateDraft();
    setBusy(true);
    try {
      const row = await api.proposeDate(match, d.place, d.place === 'custom' ? d.custom : null, day, time, note.trim() || null);
      router.replace({ pathname: '/date-pending', params: { match, date: row.id } });
    } catch { toast('Не удалось отправить приглашение'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ДЕНЬ И ВРЕМЯ" heading="Когда вам удобно?" sub="Приглашение можно изменить или отменить до ответа." />
      <Segmented items={[{ key: 'this', label: 'Эта неделя' }, { key: 'next', label: 'Следующая' }]} value={week} onChange={(k) => setWeek(k as 'this' | 'next')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {days.map((dt) => {
          const key = iso(dt), p = dayParts(dt), on = key === day;
          return (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setDay(key)}
              style={{ width: '48.5%', borderWidth: 1, borderColor: on ? colors.red : colors.line, backgroundColor: on ? colors.redWash : colors.white, borderRadius: 13, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 12 }}>{p.wd}</Text><Text style={{ fontSize: 12 }}>{p.num} {p.mon}</Text>
            </Pressable>
          );
        })}
      </View>
      <Eyebrow style={{ marginTop: 15 }}>ВРЕМЯ</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {DATE_TIMES.map((t) => <Pill key={t} label={t} active={time === t} onPress={() => setTime(t)} />)}
      </View>
      <Field value={note} onChangeText={setNote} multiline maxLength={200} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Добавьте пару слов · необязательно" />
      <Btn label="Отправить приглашение" busy={busy} onPress={send} />
      <Btn kind="ghost" label="Назад к месту" onPress={() => router.push({ pathname: '/date-place', params: { match } })} />
    </Screen>
  );
}
