import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { BackLink, Btn, Screen } from '@/components/ui';
import { FadeIn } from '@/components/Motion';
import { Label, openLesson, pb as pbs, quoteMark } from '@/components/Playbook';
import { playbookContent } from '@/playbook';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { isUnlocked, markLessonDone, usePlaybook } from '@/lib/playbook';
import { colors } from '@/theme/tokens';

// Lesson 7: the first date in three tabs — what to talk about, the kiss, after. Done once every tab was opened.
export default function PlaybookFirstDate() {
  const { t, lang } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const f = playbookContent(lang).firstDate;
  const [tab, setTab] = useState(0);
  const [seen, setSeen] = useState<number[]>([0]);
  const unlocked = isUnlocked(pb, 7);
  useEffect(() => { if (unlocked && seen.length === f.tabs.length) markLessonDone(7); }, [unlocked, seen.length, f.tabs.length]);
  if (pb.loaded && !unlocked) return <Redirect href={'/playbook/paywall?to=7' as never} />;

  const open = (i: number) => { setTab(i); setSeen((s) => (s.includes(i) ? s : [...s, i])); };
  const lastTab = tab === f.tabs.length - 1;

  return (
    <Screen tabs="me">
      <BackLink label={`‹ ${t('playbook.heading')}`} onPress={() => router.navigate('/playbook')} />
      <Label>{t('playbook.lessonLabel', { n: 7 })}</Label>
      <Text style={s.h1} accessibilityRole="header">{f.title}</Text>
      <Text style={s.intro}>{f.intro}</Text>
      <View style={s.tabs} accessibilityRole="tablist">
        {f.tabs.map((x, i) => (
          <Pressable key={i} accessibilityRole="tab" accessibilityState={{ selected: tab === i }} onPress={() => open(i)} style={[pbs.pill, s.tab, tab === i && pbs.pillOn]}>
            <Text style={[pbs.pillText, tab === i && { color: '#fff' }]} >{x.title}</Text>
          </Pressable>
        ))}
      </View>
      {f.tabs[tab].blocks.map((b, i) => (
        <FadeIn key={`${tab}-${i}`} delay={i * 50}>
          <View style={s.block}>
            <Text style={s.title}>{b.title}</Text>
            <Text style={s.text}>{b.text}</Text>
            {b.quote ? <View style={s.quote}><Text style={s.quoteText}>{quoteMark(lang, b.quote)}</Text></View> : null}
          </View>
        </FadeIn>
      ))}
      <View style={{ height: 6 }} />
      {lastTab
        ? <Btn label={t('playbook.nextLesson', { n: 8, title: playbookContent(lang).titles[8] })} onPress={() => openLesson(8, pb, true)} />
        : <Btn label={f.tabs[tab + 1].title} onPress={() => open(tab + 1)} />}
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '900', letterSpacing: -1.3, color: colors.ink, marginTop: 4 },
  intro: { fontSize: 14, lineHeight: 20, color: colors.sub, marginTop: 6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 14 },
  tab: { paddingHorizontal: 14 },
  block: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, marginBottom: 10 },
  title: { fontSize: 15.5, fontWeight: '800', color: colors.ink },
  text: { fontSize: 13.5, lineHeight: 19, color: '#5E5852', marginTop: 5 },
  quote: { marginTop: 9, alignSelf: 'flex-start', backgroundColor: colors.redWash, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  quoteText: { fontSize: 14, lineHeight: 19, color: colors.ink },
});
