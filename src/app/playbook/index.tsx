import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackLink, Meter, Screen } from '@/components/ui';
import { UiIcon } from '@/components/UiIcon';
import { FadeIn } from '@/components/Motion';
import { openLesson } from '@/components/Playbook';
import { playbookContent } from '@/playbook';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { FREE_LESSON, LESSON_COUNT, TRAINER_COUNT, isUnlocked, nextLesson, usePlaybook } from '@/lib/playbook';
import { colors } from '@/theme/tokens';

const MINUTES: Record<number, number> = { 6: 3, 7: 4, 8: 10 };

// RENVI Playbook: list of the 8 lessons with progress. Lesson 2 is free, the others open after the purchase.
export default function PlaybookHome() {
  const { t, lang } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const c = playbookContent(lang);
  const next = nextLesson(pb);
  const minutes = (n: number) => c.lessons.find((l) => l.id === n)?.minutes ?? MINUTES[n] ?? 5;
  const done = pb.done.length;

  return (
    <Screen tabs="me">
      <BackLink />
      <Text style={s.h1} accessibilityRole="header">{t('playbook.heading')}</Text>
      <Text style={s.sub}>{t('playbook.sub', { done })}</Text>
      <View style={{ marginVertical: 12 }}><Meter value={Math.round((done / LESSON_COUNT) * 100)} /></View>

      {next ? (
        <FadeIn>
          <Pressable accessibilityRole="button" onPress={() => openLesson(next, pb)} style={s.next}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nextLabel}>{t('playbook.next')}</Text>
              <Text style={s.nextTitle}>{c.titles[next]}</Text>
              <Text style={s.nextSub}>{t('playbook.minutes', { n: minutes(next) })}{next === FREE_LESSON && !pb.purchased ? ` · ${t('playbook.free')}` : ''}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 24 }}>›</Text>
          </Pressable>
        </FadeIn>
      ) : null}

      <View style={{ gap: 8, marginTop: 4 }}>
        {Array.from({ length: LESSON_COUNT }, (_, i) => i + 1).map((n, i) => {
          const isDone = pb.done.includes(n);
          const open = isUnlocked(pb, n);
          const title = n === 8 ? t('playbook.trainerItem', { n: TRAINER_COUNT }) : c.titles[n];
          return (
            <FadeIn key={n} delay={i * 40}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${n}. ${title}`} onPress={() => openLesson(n, pb)} style={[s.row, n === next && s.rowNow]}>
                <View style={[s.num, isDone && s.numDone]}>
                  {isDone ? <UiIcon name="check" size={15} color="#fff" /> : <Text style={s.numText}>{n}</Text>}
                </View>
                <Text style={[s.title, !open && { color: colors.sub }]} numberOfLines={2}>{title}</Text>
                {n === FREE_LESSON && !pb.purchased ? <Text style={[s.badge, s.badgeFree]}>{t('playbook.free')}</Text>
                  : n === next ? <Text style={[s.badge, s.badgeNow]}>{t('playbook.now')}</Text>
                  : !open ? <Text style={s.lock} accessibilityLabel={t('playbook.locked')}>🔒</Text> : null}
              </Pressable>
            </FadeIn>
          );
        })}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5, color: colors.ink },
  sub: { fontSize: 13.5, color: colors.sub, marginTop: 4 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: 20, padding: 16, marginBottom: 10 },
  nextLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: '#F3B7AE' },
  nextTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.4 },
  nextSub: { fontSize: 12.5, color: '#CFC9C1', marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 13, minHeight: 56 },
  rowNow: { borderColor: colors.chipBorder },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center' },
  numDone: { backgroundColor: colors.green },
  numText: { color: colors.redDark, fontWeight: '800', fontSize: 13 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, overflow: 'hidden' },
  badgeFree: { backgroundColor: colors.greenWash, color: colors.green },
  badgeNow: { backgroundColor: colors.redWash, color: colors.redDark },
  lock: { fontSize: 14 },
});
