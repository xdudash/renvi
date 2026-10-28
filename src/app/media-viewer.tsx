import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Loading, Screen, Tiny, useToast } from '@/components/ui';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { colors } from '@/theme/tokens';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLang } from '@/lib/lang';

// 27 · Просмотр фото / видео
export default function MediaViewer() {
  const { t } = useLang();
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
          <Image source={{ uri: url }} style={s.photo} resizeMode="cover" accessibilityLabel={t('screens.mediaViewer.mediaVIzN', { i: i + 1, n })} />
        ) : <View style={s.photo} />}
        <View style={s.top}>
          <View style={s.pill}><Text style={{ fontSize: 10 }}>{t('screens.mediaViewer.vIzN', { i: i + 1, n })}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} style={s.icon}><Text>×</Text></Pressable>
        </View>
        {cur?.kind === 'video' ? (
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? t('screens.mediaViewer.vklyuchitZvuk') : t('screens.mediaViewer.vyklyuchitZvuk')} onPress={() => { setMuted(!muted); toast(muted ? t('screens.mediaViewer.zvukVklyuchen') : t('screens.mediaViewer.zvukVyklyuchen')); }} style={[s.icon, { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.53)' }]}>
            <Text style={{ color: '#fff' }}>◖</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('screens.mediaViewer.predyduschee')} onPress={() => setI((i + n - 1) % n)} style={[s.icon, { position: 'absolute', top: '50%', left: 10 }]}><Text>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('screens.mediaViewer.sleduyuschee')} onPress={() => setI((i + 1) % n)} style={[s.icon, { position: 'absolute', top: '50%', right: 10 }]}><Text>›</Text></Pressable>
      </View>
      <Tiny>{t('screens.mediaViewer.do6MediaVideo')}</Tiny>
      <Btn kind="tertiary" label={t('screens.mediaViewer.otkrytProfil')} onPress={() => router.back()} />
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
