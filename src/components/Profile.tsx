import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Chip, Sheet, Choice, useToast } from './ui';
import { colors } from '@/theme/tokens';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { intentChip } from '@/lib/catalog';
import { api, type DiscoverCard } from '@/lib/api';
import { useLang } from '@/lib/lang';

export function ProfileHero({ path, count, at = 0, verified, label, overlay }: {
  path?: string | null; count: number; at?: number; verified?: boolean; label: string; overlay?: string;
}) {
  const { t } = useLang();
  const url = useSignedUrl(path);
  const bars = Array.from({ length: Math.min(count, 6) }).map((_, i) => (i <= at ? '▰' : '▱')).join(' ');
  return (
    <View style={s.hero}>
      {url ? <Image source={{ uri: url }} style={s.photo} resizeMode="cover" accessibilityLabel={label} /> : <View style={[s.photo, { backgroundColor: '#ddd' }]} accessibilityLabel={label} />}
      <View style={s.count}><Text style={s.countText}>{overlay ?? `${bars}　${count ? at + 1 : 0} / ${count}`}</Text></View>
      {verified ? <View style={s.verified}><Text style={s.verifiedText}>{t('components.Profile.proveren')}</Text></View> : null}
    </View>
  );
}

export function ProfileMeta({ card }: { card: Pick<DiscoverCard, 'profile_id' | 'display_name' | 'age' | 'city' | 'distance' | 'verified' | 'intent' | 'interests'> }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <View>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text>
            <Text style={s.title}>{card.display_name}, {card.age}</Text>
            {card.verified ? <Text accessibilityLabel={t('components.Profile.podtverzhdennyyProfil')}>{'  '}<Text style={s.check}> ✓ </Text></Text> : null}
          </Text>
          <Text style={s.meta}>{card.city} · {card.distance}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('components.Profile.deystviyaSProfilem')} onPress={() => setOpen(true)} style={s.more}><Text>···</Text></Pressable>
      </View>
      <View style={s.wrap}>
        <Chip label={intentChip(card.intent)} tone="red" />
        {card.verified ? <Chip label={t('components.Profile.fotoProvereno')} tone="green" /> : null}
        {card.interests.slice(0, 2).map((x) => <Chip key={x} label={x} />)}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={s.sheetH}>{t('components.Profile.chtoSdelatSProfilem')}</Text>
        <Choice onPress={() => { setOpen(false); router.push({ pathname: '/report', params: { profile: card.profile_id } }); }}><Text style={{ fontSize: 12 }}>{t('components.Profile.pozhalovatsyaNaProfil')}</Text><Text>›</Text></Choice>
        <Choice onPress={async () => { setOpen(false); try { await api.block(card.profile_id); toast(t('components.Profile.profilZablokirovan')); router.navigate('/blocked'); } catch { toast(t('components.Profile.neUdalosZablokirovat')); } }}><Text style={{ fontSize: 12 }}>{t('components.Profile.zablokirovat')}</Text><Text>›</Text></Choice>
        <Choice onPress={async () => { setOpen(false); try { await api.pass(card.profile_id); toast(t('components.Profile.profilSkryt')); router.navigate('/discover'); } catch { toast(t('components.Profile.neUdalosSkryt')); } }}><Text style={{ fontSize: 12 }}>{t('components.Profile.skrytIzPodborki')}</Text><Text>›</Text></Choice>
      </Sheet>
    </View>
  );
}

export function MediaThumb({ path, onPress, video }: { path: string; onPress: () => void; video?: boolean }) {
  const { t } = useLang();
  const url = useSignedUrl(path);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('components.Profile.fotoProfilya')} onPress={onPress} style={s.thumb}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {video ? <View style={s.thumbPill}><Text style={{ fontSize: 10 }}>{t('components.Profile.video')}</Text></View> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: { position: 'relative', marginTop: 7, marginBottom: 12 },
  photo: { width: '100%', height: 334, borderRadius: 20 },
  count: { position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(22,22,20,0.6)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  countText: { color: '#fff', fontSize: 10 },
  verified: { position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(253,252,249,0.93)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  verifiedText: { fontSize: 10, fontWeight: '700', color: colors.ink },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 31, fontWeight: '800', letterSpacing: -1.5, color: colors.ink },
  check: { backgroundColor: colors.ink, color: '#fff', fontSize: 11, borderRadius: 10, overflow: 'hidden' },
  meta: { fontSize: 11, color: colors.sub, marginTop: 5 },
  more: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 10 },
  sheetH: { fontSize: 25, fontWeight: '800', letterSpacing: -1, color: colors.ink, marginBottom: 8 },
  thumb: { width: '31.6%', aspectRatio: 0.78, borderRadius: 13, overflow: 'hidden', backgroundColor: '#eee' },
  thumbPill: { position: 'absolute', left: 5, bottom: 5, backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
});
