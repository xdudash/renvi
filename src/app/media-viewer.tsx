import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Loading, Screen, Tiny, useToast } from '@/components/ui';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { colors } from '@/theme/tokens';
import { useVideoPlayer, VideoView } from 'expo-video';

// 27 · Просмотр фото / видео
export default function MediaViewer() {
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>();
  const { data: card, loading } = useProfileCard(id);
  const [i, setI] = useState(Number(at ?? 0));
  const [muted, setMuted] = useState(true);
  const toast = useToast();
  const media = card?.photos ?? [];
  const cur = media[i];
  const url = useSignedUrl(cur?.path);
  if (loading) return <Screen><BackLink /><Loading /></Screen>;
  const n = media.length || 1;
  return (
    <Screen>
      <BackLink />
      <View style={s.frame}>
        {cur?.kind === 'video' && url ? (
          <Clip url={url} muted={muted} />
        ) : url ? (
          <Image source={{ uri: url }} style={s.photo} resizeMode="cover" accessibilityLabel={`Медиа ${i + 1} из ${n}`} />
        ) : <View style={s.photo} />}
        <View style={s.top}>
          <View style={s.pill}><Text style={{ fontSize: 10 }}>{i + 1} из {n}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => router.back()} style={s.icon}><Text>×</Text></Pressable>
        </View>
        {cur?.kind === 'video' ? (
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Включить звук' : 'Выключить звук'} onPress={() => { setMuted(!muted); toast(muted ? 'Звук включён' : 'Звук выключен'); }} style={[s.icon, { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.53)' }]}>
            <Text style={{ color: '#fff' }}>◖</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Предыдущее" onPress={() => setI((i + n - 1) % n)} style={[s.icon, { position: 'absolute', top: '50%', left: 10 }]}><Text>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Следующее" onPress={() => setI((i + 1) % n)} style={[s.icon, { position: 'absolute', top: '50%', right: 10 }]}><Text>›</Text></Pressable>
      </View>
      <Tiny>До 6 медиа · видео до 15 секунд · видео запускается без звука</Tiny>
      <Btn kind="tertiary" label="Открыть профиль" onPress={() => router.back()} />
    </Screen>
  );
}
const s = StyleSheet.create({
  frame: { backgroundColor: colors.ink, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: 334, backgroundColor: '#333' },
  top: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 7 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
});

// Short profile video: starts muted and loops, as in the prototype.
function Clip({ url, muted }: { url: string; muted: boolean }) {
  const player = useVideoPlayer(url, (p) => { p.loop = true; p.muted = true; p.play(); });
  const ref = useRef(player);
  useEffect(() => { ref.current = player; }, [player]);
  useEffect(() => { ref.current.muted = muted; }, [muted]);
  return <VideoView player={player} style={s.photo} contentFit="cover" nativeControls={false} />;
}
