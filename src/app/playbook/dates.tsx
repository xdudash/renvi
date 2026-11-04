import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { BackLink, Btn, Screen } from '@/components/ui';
import { UiIcon } from '@/components/UiIcon';
import { FadeIn } from '@/components/Motion';
import { Label, openLesson, pb as pbs } from '@/components/Playbook';
import { playbookContent } from '@/playbook';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { isUnlocked, markLessonDone, usePlaybook } from '@/lib/playbook';
import { colors } from '@/theme/tokens';

const BUDGETS = [null, 0, 15, 40] as const;
const TINTS = ['#E7DCCF', '#E3E6DA', '#DCE3E6', '#EBDDD8', '#E6DFD0', '#DEE0E8'];

// Lesson 6: ready date routes in Bratislava, filtered by budget.
export default function PlaybookDates() {
  const { t, lang } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const d = playbookContent(lang).dates;
  const titles = playbookContent(lang).titles;
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]>(null);
  const unlocked = isUnlocked(pb, 6);
  useEffect(() => { if (unlocked && pb.loaded) markLessonDone(6); }, [unlocked, pb.loaded]);
  if (pb.loaded && !unlocked) return <Redirect href={'/playbook/paywall?to=6' as never} />;

  const label = (b: (typeof BUDGETS)[number]) => (b === null ? t('playbook.budgetAll') : b === 0 ? t('playbook.budgetFree') : t('playbook.budgetUpTo', { n: b }));
  const routes = d.routes.map((r, i) => ({ r, i })).filter(({ r }) => budget === null || r.budget === budget);

  return (
    <Screen tabs="me">
      <BackLink label={`‹ ${t('playbook.heading')}`} onPress={() => router.navigate('/playbook')} />
      <Label>{t('playbook.lessonLabel', { n: 6 })}</Label>
      <Text style={s.h1} accessibilityRole="header">{d.title}</Text>
      <Text style={s.intro}>{d.intro}</Text>
      <View style={s.pills}>
        {BUDGETS.map((b) => (
          <Pressable key={String(b)} accessibilityRole="button" accessibilityState={{ selected: budget === b }} onPress={() => setBudget(b)} style={[pbs.pill, budget === b && pbs.pillOn]}>
            <Text style={[pbs.pillText, budget === b && { color: '#fff' }]}>{label(b)}</Text>
          </Pressable>
        ))}
      </View>
      {routes.map(({ r, i }, k) => (
        <FadeIn key={r.title} delay={k * 50}>
          <View style={s.card}>
            <View style={[s.banner, { backgroundColor: TINTS[i % TINTS.length] }]}>
              <UiIcon name="pin" size={18} color={colors.ink} />
              <Text style={s.bannerText}>{label(r.budget)}</Text>
            </View>
            <View style={{ padding: 14 }}>
              <View style={s.titleRow}>
                <Text style={s.title}>{r.title}</Text>
                <Text style={s.time}>{r.time}</Text>
              </View>
              <View style={{ gap: 7, marginTop: 10 }}>
                {r.stops.map((stop, j) => (
                  <View key={j} style={s.stop}>
                    <View style={s.stopNum}><Text style={s.stopNumText}>{j + 1}</Text></View>
                    <Text style={s.stopText}>{stop}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.topic}>{t('playbook.topic', { topic: r.topic })}</Text>
            </View>
          </View>
        </FadeIn>
      ))}
      <View style={[pbs.dark, { marginTop: 4, marginBottom: 14, gap: 8 }]}>
        <Label tone="light">{t('playbook.rulesTitle')}</Label>
        {d.rules.map((rule, i) => <Text key={i} style={s.rule}>{i + 1}. {rule}</Text>)}
      </View>
      <Btn label={t('playbook.nextLesson', { n: 7, title: titles[7] })} onPress={() => openLesson(7, pb, true)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '900', letterSpacing: -1.3, color: colors.ink, marginTop: 4 },
  intro: { fontSize: 14, lineHeight: 20, color: colors.sub, marginTop: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  banner: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  bannerText: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16.5, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  time: { fontSize: 12, color: colors.sub },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stopNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center' },
  stopNumText: { fontSize: 11, fontWeight: '900', color: colors.redDark },
  stopText: { flex: 1, fontSize: 13.5, color: colors.ink },
  topic: { marginTop: 11, fontSize: 12.5, lineHeight: 18, color: '#5E5852' },
  rule: { color: '#fff', fontSize: 13.5, lineHeight: 19 },
});
