import { Image, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Btn, Eyebrow, Screen } from '@/components/ui';
import { BrandMark } from '@/components/BrandMark';
import { useDiscover } from '@/lib/discover';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useMyPhotos } from '@/hooks/usePhotos';
import { colors } from '@/theme/tokens';

// 39 · Экран взаимности
export default function Match() {
  const { lastMatch } = useDiscover();
  const theirs = useSignedUrl(lastMatch?.partner.photo);
  const { items } = useMyPhotos();
  if (!lastMatch) return <Redirect href="/chats" />;
  const chat = () => router.replace({ pathname: '/chat', params: { match: lastMatch.match_id } });
  return (
    <Screen tabs="likes">
      <View style={s.hero}>
        <Eyebrow>ВЫ ОБА СДЕЛАЛИ ПЕРВЫЙ ШАГ</Eyebrow>
        <View style={s.faces}>
          {theirs ? <Image source={{ uri: theirs }} style={s.face} accessibilityLabel={lastMatch.partner.name} /> : <View style={[s.face, { backgroundColor: colors.blush }]} />}
          {items[0]?.url ? <Image source={{ uri: items[0].url }} style={s.face} accessibilityLabel="Ваш профиль" /> : <View style={[s.face, { backgroundColor: colors.blush }]} />}
        </View>
        <BrandMark size={62} />
        <Text style={s.title} accessibilityRole="header">Это взаимно.</Text>
        <Text style={s.lede}>Вы и {lastMatch.partner.name} заинтересовали друг друга. Есть с чего начать.</Text>
        <Text style={{ fontSize: 10, letterSpacing: 0.2, color: colors.sub, marginTop: 18, marginBottom: 8 }}>Make it mutual.</Text>
      </View>
      <Btn label="Начать разговор" onPress={chat} />
      <Btn kind="secondary" label="Предложить встречу" onPress={() => router.replace({ pathname: '/date-create', params: { match: lastMatch.match_id } })} />
      <Btn kind="ghost" label="Продолжить знакомиться" onPress={() => router.replace('/discover')} />
      <Btn kind="ghost" label="Уведомлять об ответах" onPress={() => router.push({ pathname: '/push-prompt', params: { match: lastMatch.match_id } })} />
    </Screen>
  );
}
const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 7, paddingBottom: 13 },
  faces: { flexDirection: 'row', gap: 9, marginTop: 17, marginBottom: 20 },
  face: { width: 112, height: 112, borderRadius: 56 },
  title: { fontSize: 47, fontWeight: '900', lineHeight: 46, letterSpacing: -2.8, color: colors.ink, marginTop: 20, marginBottom: 13 },
  lede: { fontSize: 13, lineHeight: 20, color: colors.sub, maxWidth: 285, textAlign: 'center' },
});
