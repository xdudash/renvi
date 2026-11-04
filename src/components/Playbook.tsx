// Building blocks of the RENVI Playbook screens: chat bubbles, lesson cards, the three-answer quiz.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { UiIcon } from './UiIcon';
import { colors } from '@/theme/tokens';
import type { LessonCard, Msg } from '@/playbook';
import { useLang } from '@/lib/lang';
import { isUnlocked, type PlaybookState } from '@/lib/playbook';

export const quoteMark = (lang: string, text: string) => (lang === 'RU' || lang === 'UA' || lang === 'SK' || lang === 'CS' ? `«${text}»` : `“${text}”`);
export const LETTERS = (lang: string) => (lang === 'RU' || lang === 'UA' ? ['А', 'Б', 'В'] : ['A', 'B', 'C']);

/** Where lesson `n` lives; a locked lesson goes to the paywall first. */
export function lessonHref(n: number, s: PlaybookState): string {
  if (!isUnlocked(s, n)) return `/playbook/paywall?to=${n}`;
  if (n === 6) return '/playbook/dates';
  if (n === 7) return '/playbook/first-date';
  if (n === 8) return '/playbook/trainer';
  return `/playbook/${n}`;
}
export const openLesson = (n: number, s: PlaybookState, replace = false) =>
  (replace ? router.replace : router.push)(lessonHref(n, s) as never);

export function Chat({ msgs, status }: { msgs: Msg[]; status?: string }) {
  if (!msgs.length) return null;
  return (
    <View style={s.chat}>
      {msgs.map((m, i) => (
        <View key={i} style={[s.bubble, m.me ? s.me : s.her]}>
          <Text style={[s.bubbleText, m.me && { color: '#fff' }]}>{m.text}</Text>
        </View>
      ))}
      {status ? <Text style={s.status}>{status}</Text> : null}
    </View>
  );
}

export function Label({ children, tone = 'sub' }: { children: React.ReactNode; tone?: 'sub' | 'red' | 'green' | 'light' }) {
  const color = { sub: colors.eyebrow, red: colors.redDark, green: colors.green, light: '#F3B7AE' }[tone];
  return <Text style={[s.label, { color }]}>{children}</Text>;
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <View style={[s.mark, { backgroundColor: ok ? colors.green : colors.red }]}>
      {ok ? <UiIcon name="check" size={14} color="#fff" /> : <Text style={s.markX}>✕</Text>}
    </View>
  );
}

/** Three answers; after a choice the best one turns green, a wrong pick red, and the explanation appears. */
export function Quiz({ options, best, why, picked, onPick }: {
  options: readonly string[]; best: number; why: string; picked: number | null; onPick: (i: number) => void;
}) {
  const { t, lang } = useLang();
  const letters = LETTERS(lang);
  return (
    <View style={{ gap: 8 }}>
      {options.map((o, i) => {
        const done = picked !== null;
        const tone = done && i === best ? 'good' : done && i === picked ? 'bad' : 'plain';
        return (
          <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: picked === i, disabled: done }} disabled={done}
            onPress={() => onPick(i)} style={[s.option, tone === 'good' && s.optionGood, tone === 'bad' && s.optionBad]}>
            <Text style={[s.optionLetter, tone === 'good' && { color: colors.green }, tone === 'bad' && { color: colors.redDark }]}>{letters[i]}</Text>
            <Text style={s.optionText}>{o}</Text>
          </Pressable>
        );
      })}
      {picked !== null ? (
        <View style={s.why}>
          <Text style={s.whyHead}>{picked === best ? t('playbook.right', { letter: letters[best] }) : t('playbook.wrong', { letter: letters[best] })}</Text>
          <Text style={s.whyText}>{why}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One card of a lesson (lessons 1–5). The quiz keeps its own answer only while the card is shown. */
export function CardView({ card, onAnswered }: { card: LessonCard; onAnswered?: () => void }) {
  const { t } = useLang();
  const [picked, setPicked] = useState<number | null>(null);
  switch (card.type) {
    case 'idea':
      return (
        <View style={{ gap: 10 }}>
          <Text style={s.h}>{card.title}</Text>
          <Text style={s.p}>{card.text}</Text>
        </View>
      );
    case 'compare':
      return (
        <View style={{ gap: 10 }}>
          <View style={s.box}>
            <Label tone="red">{card.badLabel}</Label>
            <Chat msgs={card.bad} />
            <Text style={s.note}>{card.badNote}</Text>
          </View>
          <View style={[s.box, s.boxGood]}>
            <Label tone="green">{card.goodLabel}</Label>
            <Chat msgs={card.good} />
            <Text style={s.note}>{card.goodNote}</Text>
          </View>
        </View>
      );
    case 'dos':
      return (
        <View style={{ gap: 10 }}>
          <Text style={s.h}>{card.title}</Text>
          {card.text ? <Text style={s.p}>{card.text}</Text> : null}
          {card.items.map((it, i) => (
            <View key={i} style={[s.line, it.ok && s.lineGood]}>
              <Mark ok={it.ok} />
              <Text style={[s.lineText, !it.ok && { color: colors.sub }]}>{it.text}</Text>
            </View>
          ))}
        </View>
      );
    case 'examples':
      return (
        <View style={{ gap: 10 }}>
          <View style={s.dark}>
            <Label tone="light">{card.title}</Label>
            <Text style={s.darkText}>{card.context}</Text>
          </View>
          {card.items.map((it, i) => (
            <View key={i} style={s.box}>
              <Label tone={i === 0 ? 'red' : 'sub'}>{it.label}</Label>
              <Text style={s.example}>{it.text}</Text>
            </View>
          ))}
        </View>
      );
    case 'tips':
      return (
        <View style={{ gap: 8 }}>
          <Text style={s.h}>{card.title}</Text>
          {card.items.map((it, i) => (
            <View key={i} style={s.tip}>
              <Text style={s.tipTitle}>{it.title}</Text>
              <Text style={s.tipText}>{it.text}</Text>
            </View>
          ))}
        </View>
      );
    case 'rule':
      return (
        <View style={s.dark}>
          <Label tone="light">{card.title}</Label>
          <Text style={[s.darkText, { fontSize: 18, lineHeight: 25, fontWeight: '700' }]}>{card.text}</Text>
        </View>
      );
    case 'quiz':
      return (
        <View style={{ gap: 10 }}>
          <Label>{t('playbook.check')}</Label>
          <Text style={s.p}>{card.context}</Text>
          {card.chat ? <Chat msgs={card.chat} /> : null}
          <Quiz options={card.options} best={card.best} why={card.why} picked={picked} onPick={(i) => { setPicked(i); onAnswered?.(); }} />
        </View>
      );
    case 'summary':
      return (
        <View style={s.dark}>
          <Text style={[s.darkText, { fontSize: 20, lineHeight: 27, fontWeight: '800' }]}>{card.text}</Text>
        </View>
      );
  }
}

export const pb = StyleSheet.create({
  pill: { height: 38, paddingHorizontal: 15, borderRadius: 19, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  dark: { backgroundColor: colors.ink, borderRadius: 20, padding: 16 },
});

const s = StyleSheet.create({
  h: { fontSize: 24, fontWeight: '900', letterSpacing: -1, color: colors.ink, lineHeight: 27 },
  p: { fontSize: 15, lineHeight: 22, color: '#4a4541' },
  label: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  chat: { gap: 5, marginVertical: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 17 },
  her: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 5 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.red, borderBottomRightRadius: 5 },
  bubbleText: { fontSize: 14.5, lineHeight: 20, color: colors.ink },
  status: { alignSelf: 'flex-end', fontSize: 11, color: colors.muted, marginTop: 2 },
  box: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 13 },
  boxGood: { borderColor: '#cfe5d7', backgroundColor: '#F2F8F4' },
  note: { fontSize: 13, lineHeight: 18, color: colors.sub },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 11 },
  lineGood: { borderColor: '#cfe5d7' },
  lineText: { flex: 1, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markX: { color: '#fff', fontSize: 12, fontWeight: '900' },
  dark: { backgroundColor: colors.ink, borderRadius: 20, padding: 16, gap: 6 },
  darkText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  example: { fontSize: 15.5, lineHeight: 21, color: colors.ink, marginTop: 4 },
  tip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 11 },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  tipText: { fontSize: 13, lineHeight: 18, color: colors.sub, marginTop: 3 },
  option: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, minHeight: 48 },
  optionGood: { borderColor: colors.green, borderWidth: 2, backgroundColor: '#F2F8F4' },
  optionBad: { borderColor: colors.red, borderWidth: 2, backgroundColor: colors.redWash },
  optionLetter: { fontSize: 14, fontWeight: '900', color: colors.sub, width: 16 },
  optionText: { flex: 1, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  why: { backgroundColor: colors.ink, borderRadius: 16, padding: 14, gap: 5 },
  whyHead: { color: '#F3B7AE', fontSize: 13, fontWeight: '800' },
  whyText: { color: '#fff', fontSize: 14, lineHeight: 20 },
});
