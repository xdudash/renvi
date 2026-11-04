import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, LinkBtn, Meter, Screen } from '@/components/ui';
import { FadeIn } from '@/components/Motion';
import { CardView, Label, openLesson } from '@/components/Playbook';
import { playbookContent } from '@/playbook';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { isUnlocked, markLessonDone, usePlaybook } from '@/lib/playbook';
import { colors } from '@/theme/tokens';

// Lessons 1–5: a short run of cards (thought → examples → rule → check yourself → summary).
export default function PlaybookLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = Number(id);
  const { t, lang } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const lesson = playbookContent(lang).lessons.find((l) => l.id === n);
  const titles = playbookContent(lang).titles;
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const card = lesson?.cards[i];
  const last = lesson ? i === lesson.cards.length - 1 : false;

  useEffect(() => { if (last) markLessonDone(n); }, [last, n]);

  if (!lesson || !card) return <Redirect href="/playbook" />;
  // Deep link to a paid lesson without the purchase: the paywall instead (the list does the same).
  if (pb.loaded && !isUnlocked(pb, n)) return <Redirect href={`/playbook/paywall?to=${n}` as never} />;

  const go = (to: number) => { setI(to); setAnswered(false); };
  const waiting = card.type === 'quiz' && !answered;

  return (
    <Screen tabs="me" scroll={false}>
      <BackLink label={`‹ ${t('playbook.heading')}`} onPress={() => router.navigate('/playbook')} />
      <View style={s.head}>
        <Label>{t('playbook.lessonLabel', { n })}</Label>
        <Text style={s.step}>{t('playbook.step', { n: i + 1, total: lesson.cards.length })}</Text>
      </View>
      <Meter value={Math.round(((i + 1) / lesson.cards.length) * 100)} />
      <ScrollView style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <FadeIn key={i} from={8}>
          <CardView card={card} onAnswered={() => setAnswered(true)} />
        </FadeIn>
      </ScrollView>
      <View style={{ gap: 6, paddingTop: 6 }}>
        {last ? (
          <>
            <Btn label={t('playbook.nextLesson', { n: n + 1, title: titles[n + 1] })} onPress={() => openLesson(n + 1, pb, true)} />
            {n >= 3 ? <LinkBtn center label={t('playbook.toTrainer')} onPress={() => openLesson(8, pb, true)} /> : null}
          </>
        ) : (
          <Btn label={t('playbook.nextCard')} disabled={waiting} onPress={() => go(i + 1)} />
        )}
        {i > 0 ? <LinkBtn center label={t('common.back')} onPress={() => go(i - 1)} /> : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  step: { fontSize: 12, color: colors.sub, fontWeight: '600' },
});
