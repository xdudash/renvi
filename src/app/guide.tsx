import { useEffect, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackLink, Btn, Meter, Screen, Tiny, Title } from '@/components/ui';
import { UiIcon } from '@/components/UiIcon';
import { FadeIn } from '@/components/Motion';
import { guideChapters } from '@/i18n/guide';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const READ_KEY = 'renvi.guide.read';

// Гайд «Знакомься уверенно»: короткие главы-аккордеоны; прочитанные главы отмечаются галочкой (на устройстве).
export default function Guide() {
  const { t, lang } = useLang();
  const chapters = guideChapters(lang);
  const [open, setOpen] = useState<number | null>(0);
  const [read, setRead] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(READ_KEY).then((v) => { if (v) setRead(JSON.parse(v) as number[]); }).catch(() => {});
  }, []);
  const markRead = (n: number) => {
    const next = read.includes(n) ? read : [...read, n];
    setRead(next);
    AsyncStorage.setItem(READ_KEY, JSON.stringify(next)).catch(() => {});
    toggle(n + 1 < chapters.length ? n + 1 : null);
  };
  const toggle = (n: number | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === n ? null : n));
  };
  const done = read.filter((n) => n < chapters.length).length;

  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('guide.kicker')} heading={t('guide.heading')} sub={t('guide.sub')} />
      <View style={{ marginBottom: 14 }}>
        <Tiny>{t('guide.progress', { done, total: chapters.length })}</Tiny>
        <View style={{ marginTop: 8 }}><Meter value={Math.round((done / chapters.length) * 100)} /></View>
      </View>
      {chapters.map((c, n) => {
        const isOpen = open === n;
        const isRead = read.includes(n);
        return (
          <FadeIn key={n} delay={n * 60}>
            <View style={[s.card, isOpen && s.cardOpen]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => toggle(n)} style={s.head}>
                <View style={[s.num, isRead && s.numRead]}>
                  {isRead ? <UiIcon name="check" size={16} color="#fff" /> : <Text style={s.numText}>{n + 1}</Text>}
                </View>
                <Text style={s.title}>{c.title}</Text>
                <Text style={[s.chev, isOpen && { transform: [{ rotate: '90deg' }] }]}>›</Text>
              </Pressable>
              {isOpen ? (
                <View style={s.body}>
                  <Text style={s.lead}>{c.lead}</Text>
                  {c.tips.map((tip, k) => (
                    <View key={k} style={s.tip}>
                      <View style={s.dot} />
                      <Text style={s.tipText}>{tip}</Text>
                    </View>
                  ))}
                  <Btn kind={isRead ? 'ghost' : 'secondary'} label={isRead ? t('guide.readAgain') : t('guide.markRead')} onPress={() => markRead(n)} />
                </View>
              ) : null}
            </View>
          </FadeIn>
        );
      })}
      <View style={{ height: 6 }} />
      <Btn label={t('guide.cta')} onPress={() => router.push('/edit-profile')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
  cardOpen: { borderColor: colors.chipBorder },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 60 },
  num: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center' },
  numRead: { backgroundColor: colors.green },
  numText: { color: colors.redDark, fontWeight: '800', fontSize: 14 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  chev: { fontSize: 22, color: colors.sub, width: 16, textAlign: 'center' },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  lead: { fontSize: 14, lineHeight: 20, color: colors.ink, marginBottom: 10 },
  tip: { flexDirection: 'row', gap: 10, marginBottom: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginTop: 7 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#4a4541' },
});
