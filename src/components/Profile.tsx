import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Chip, Sheet, Choice, PromptCard, VerifiedBadge, useToast } from './ui';
import { UiIcon } from './UiIcon';
import { colors } from '@/theme/tokens';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { intentChip, interestLabel } from '@/lib/catalog';
import { detailChips, detailTitle, type DetailKey } from '@/lib/details';
import { api, type DiscoverCard, type PhotoRow, type ProfileDetails } from '@/lib/api';
import { useLang } from '@/lib/lang';

type HeroPhoto = Pick<PhotoRow, 'path'> & { kind?: string };

/**
 * Large photo card. With `photos` the user taps the right / left half to go through them (segment bars on top);
 * with `name` the name, age, verified badge and `sub` line sit on a dark gradient over the photo.
 */
export function ProfileHero({ path, photos, count, at = 0, verified, label, overlay, name, age, sub, height = 470 }: {
  path?: string | null; photos?: HeroPhoto[]; count: number; at?: number; verified?: boolean; label: string; overlay?: string;
  name?: string; age?: number | null; sub?: string; height?: number;
}) {
  const { t } = useLang();
  const list = photos?.length ? photos : path ? [{ path }] : [];
  const total = Math.max(count, list.length);
  const [i, setI] = useState(at);
  const cur = Math.min(i, Math.max(0, list.length - 1));
  const url = useSignedUrl(list[cur]?.path ?? null);
  const go = (d: number) => setI((v) => Math.max(0, Math.min(list.length - 1, v + d)));
  return (
    <View style={[s.hero, { height }]}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={label} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#e7e1da' }]} accessibilityLabel={label} />}
      {list.length > 1 ? (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('card.prevPhoto')} onPress={() => go(-1)} />
            <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('card.nextPhoto')} onPress={() => go(1)} />
          </View>
        </View>
      ) : null}
      {total > 1 ? (
        <View style={s.bars} pointerEvents="none" accessibilityLabel={t('card.photoOf', { n: cur + 1, total })}>
          {Array.from({ length: Math.min(total, 6) }).map((_, n) => <View key={n} style={[s.bar, n === cur && s.barOn]} />)}
        </View>
      ) : null}
      {overlay ? <View style={s.count} pointerEvents="none"><Text style={s.countText}>{overlay}</Text></View> : null}
      {name ? (
        <LinearGradient pointerEvents="none" colors={['rgba(20,16,14,0)', 'rgba(20,16,14,0.55)', 'rgba(20,16,14,0.82)']} style={s.shade}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
            {verified ? <VerifiedBadge size={24} label={t('card.verified')} /> : null}
          </View>
          {sub ? (
            <View style={s.subRow}>
              <UiIcon name="pin" size={14} color="#fff" />
              <Text style={s.sub} numberOfLines={1}>{sub}</Text>
            </View>
          ) : null}
        </LinearGradient>
      ) : verified ? <View style={s.verified}><Text style={s.verifiedText}>{t('components.Profile.proveren')}</Text></View> : null}
    </View>
  );
}

/** Chips under the photo (goal, photo check, details, interests) and the "···" actions. The name is on the photo. */
export function ProfileMeta({ card, showInterests = true }: {
  card: Pick<DiscoverCard, 'profile_id' | 'display_name' | 'age' | 'city' | 'distance' | 'verified' | 'intent' | 'interests'> & { details?: ProfileDetails };
  showInterests?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const chips = detailChips(t, card.details).slice(0, 4);
  return (
    <View>
      <View style={s.metaRow}>
        <View style={[s.wrap, { flex: 1 }]}>
          <Chip label={intentChip(card.intent, t)} tone="red" />
          {card.verified ? <Chip label={t('components.Profile.fotoProvereno')} tone="green" /> : null}
          {chips.map((c) => <Chip key={c.key} icon={c.icon} label={c.label} />)}
          {showInterests ? card.interests.slice(0, 3).map((x) => <Chip key={x} label={interestLabel(t, x)} />) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('components.Profile.deystviyaSProfilem')} onPress={() => setOpen(true)} style={s.more}><Text style={{ fontSize: 16, color: colors.ink }}>···</Text></Pressable>
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

/** "Подробнее обо мне": two-column tiles (icon, title, value) for every filled-in detail. */
export function DetailsGrid({ details }: { details?: ProfileDetails }) {
  const { t } = useLang();
  const chips = detailChips(t, details);
  if (!chips.length) return null;
  return (
    <View>
      <Text style={s.section}>{t('details.section')}</Text>
      <View style={s.grid}>
        {chips.map((c) => (
          <View key={c.key} style={s.tile}>
            <Text style={s.tileIcon}>{c.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.tileTitle}>{detailTitle(t, c.key as DetailKey | 'height_cm' | 'languages')}</Text>
              <Text style={s.tileValue}>{c.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A photo inside the card body (between answers); tap opens the viewer. */
export function InlinePhoto({ path, onPress, label }: { path: string; onPress: () => void; label: string }) {
  const url = useSignedUrl(path);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.inline}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
    </Pressable>
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
  hero: { position: 'relative', marginTop: 7, marginBottom: 12, borderRadius: 26, overflow: 'hidden', backgroundColor: '#e7e1da' },
  bars: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  barOn: { backgroundColor: '#fff' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 70, paddingBottom: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 34, fontWeight: '900', letterSpacing: -1.4, color: '#fff' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.92)', fontWeight: '600' },
  count: { position: 'absolute', left: 12, top: 22, backgroundColor: 'rgba(22,22,20,0.6)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  countText: { color: '#fff', fontSize: 10 },
  verified: { position: 'absolute', right: 12, top: 22, backgroundColor: 'rgba(253,252,249,0.93)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  verifiedText: { fontSize: 10, fontWeight: '700', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  more: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 },
  sheetH: { fontSize: 25, fontWeight: '800', letterSpacing: -1, color: colors.ink, marginBottom: 8 },
  section: { fontSize: 24, fontWeight: '800', letterSpacing: -1, color: colors.ink, marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.6%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 },
  tileIcon: { fontSize: 20 },
  tileTitle: { fontSize: 10, color: colors.sub, fontWeight: '600' },
  tileValue: { fontSize: 13, color: colors.ink, fontWeight: '700', marginTop: 2 },
  inline: { width: '100%', height: 400, borderRadius: 24, overflow: 'hidden', backgroundColor: '#e7e1da', marginVertical: 10 },
  thumb: { width: '31.6%', aspectRatio: 0.78, borderRadius: 13, overflow: 'hidden', backgroundColor: '#eee' },
  thumbPill: { position: 'absolute', left: 5, bottom: 5, backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
});

/** Answers and the rest of the photos, alternating (answer, photo, answer, …) like a story through the profile. */
export function StoryBody({ card, onReply, onPhoto }: {
  card: Pick<DiscoverCard, 'display_name' | 'prompts' | 'photos'>;
  onReply?: (p: DiscoverCard['prompts'][number]) => void;
  onPhoto: (at: number) => void;
}) {
  const { t } = useLang();
  const photos = card.photos.slice(1).filter((p) => p.kind !== 'video');
  const n = Math.max(card.prompts.length, photos.length);
  const out: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const p = card.prompts[k];
    if (p) out.push(<PromptCard key={'q' + k} question={p.question} answer={p.answer} onReply={onReply ? () => onReply(p) : undefined} />);
    const ph = photos[k];
    if (ph) out.push(<InlinePhoto key={'p' + ph.id} path={ph.path} label={t('card.photoOf', { n: k + 2, total: card.photos.length })} onPress={() => onPhoto(card.photos.indexOf(ph))} />);
  }
  return <>{out}</>;
}
