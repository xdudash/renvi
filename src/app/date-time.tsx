import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Eyebrow, Field, Pill, Screen, Segmented, Title, useToast } from '@/components/ui';
import { DATE_TIMES, dayParts, getDateDraft, iso, setDateDraft, weekDays } from '@/lib/dateDraft';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 57 · Дата и время
export default function DateTime() {
  const { t } = useLang();
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
    if (!day) { toast(t('screens.dateTime.pickDay')); return; }
    setDateDraft({ day, time, note });
    const d = getDateDraft();
    setBusy(true);
    try {
      const row = await api.proposeDate(match, d.place, d.place === 'custom' ? d.custom : null, day, time, note.trim() || null);
      router.replace({ pathname: '/date-pending', params: { match, date: row.id } });
    } catch { toast(t('screens.dateTime.sendFailed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.dateTime.kicker')} heading={t('screens.dateTime.heading')} sub={t('screens.dateTime.sub')} />
      <Segmented items={[{ key: 'this', label: t('screens.dateTime.thisWeek') }, { key: 'next', label: t('screens.dateTime.nextWeek') }]} value={week} onChange={(k) => setWeek(k as 'this' | 'next')} />
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
      <Eyebrow style={{ marginTop: 15 }}>{t('screens.dateTime.time')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {DATE_TIMES.map((tm) => <Pill key={tm} label={tm} active={time === tm} onPress={() => setTime(tm)} />)}
      </View>
      <Field value={note} onChangeText={setNote} multiline maxLength={200} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.dateTime.notePlaceholder')} />
      <Btn label={t('screens.dateTime.send')} busy={busy} onPress={send} />
      <Btn kind="ghost" label={t('screens.dateTime.backToPlace')} onPress={() => router.push({ pathname: '/date-place', params: { match } })} />
    </Screen>
  );
}
