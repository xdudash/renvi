import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from './BrandMark';
import { colors } from '@/theme/tokens';

const NAV: [string, string][] = [
  ['/admin', 'Дашборд'], ['/admin/reports', 'Жалобы'], ['/admin/appeals', 'Апелляции'], ['/admin/verification', 'Проверка селфи'],
  ['/admin/users', 'Пользователи'], ['/admin/config', 'Тарифы и настройки'], ['/admin/referrals', 'Рефералы'], ['/admin/errors', 'Журнал ошибок'],
];

export function AdminPage({ title, children }: { title: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={s.bar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><BrandMark size={24} /><Text style={s.word}>renvi · admin</Text></View>
        <Pressable onPress={() => router.replace('/')}><Text style={s.link}>В приложение</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.nav}>
        {NAV.map(([href, label]) => (
          <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: path === href }} onPress={() => router.replace(href as never)} style={[s.tab, path === href && s.tabOn]}>
            <Text style={[s.tabText, path === href && { color: colors.paper }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.h1}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Tbl({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <ScrollView horizontal>
      <View>
        <View style={[s.tr, { borderTopWidth: 0 }]}>{head.map((h) => <Text key={h} style={[s.td, s.th]}>{h}</Text>)}</View>
        {rows.map((r, i) => <View key={i} style={s.tr}>{r.map((c, j) => <View key={j} style={s.td}>{typeof c === 'string' || typeof c === 'number' ? <Text style={s.cell}>{c}</Text> : c}</View>)}</View>)}
      </View>
    </ScrollView>
  );
}
export function Act({ label, onPress, tone = 'ink' }: { label: string; onPress: () => void; tone?: 'ink' | 'red' | 'green' }) {
  const bg = tone === 'red' ? colors.red : tone === 'green' ? colors.green : colors.ink;
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.act, { backgroundColor: bg }]}><Text style={s.actText}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  word: { fontSize: 20, fontWeight: '900', letterSpacing: -1, color: colors.ink },
  link: { fontSize: 12, fontWeight: '700', color: colors.redDark },
  nav: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  tab: { borderWidth: 1, borderColor: colors.ink, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  body: { padding: 18, paddingBottom: 60 },
  h1: { fontSize: 34, fontWeight: '800', letterSpacing: -1.8, color: colors.ink, marginBottom: 14 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line },
  td: { width: 160, paddingVertical: 10, paddingRight: 10 },
  th: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.eyebrow },
  cell: { fontSize: 12, color: colors.ink },
  act: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4, alignSelf: 'flex-start' },
  actText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
