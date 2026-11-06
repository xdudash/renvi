import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ActionSet, Chip, LinkBtn, Screen, Tiny, useToast } from '@/components/ui';
import { ProfileHero, ProfileMeta } from '@/components/Profile';
import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard';
import { EmptyDiscover, ErrorRetryState, OfflineState } from '@/components/States';
import { LoadingCards } from '@/components/LoadingCards';
import { PeopleHead } from '@/components/PeopleHead';
import { useModes } from '@/hooks/useModes';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useDiscover } from '@/lib/discover';
import { useSession, useSparkLimit } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { interestLabel } from '@/lib/catalog';
import { colors } from '@/theme/tokens';
import type { DiscoverCard } from '@/lib/api';

// 25 · Главная карточка. The card fills one screen (photo, name, a line of chips, the buttons); everything else —
// answers, more photos, details — is on the full profile ("Профиль" or a tap on the name).
export default function Discover() {
  const { t } = useLang();
  const toast = useToast();
  const d = useDiscover();
  const { profile } = useSession();
  const limit = useSparkLimit();
  const swipe = useRef<SwipeCardHandle>(null);
  const { modes, reload: reloadModes } = useModes();
  useReloadOnFocus(reloadModes);
  useEffect(() => { d.ensure(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = d.current;
  const mine: string[] = profile?.interests ?? [];
  const common = card ? card.interests.filter((x) => mine.includes(x)) : [];
  const left = Math.max(0, limit - d.likesUsed);

  const openProfile = (c: DiscoverCard) => router.push({ pathname: '/profile', params: { id: c.profile_id } });

  // `flung`: the card already left the screen (swipe); otherwise the button press animates it out first.
  const doSpark = async (flung: boolean) => {
    if (!card) return;
    if (d.likesUsed >= limit) { swipe.current?.reset(); router.push('/like-limit'); return; }
    if (!flung) await swipe.current?.fling('right');
    try {
      const r = await d.spark(card, { kind: 'profile', ref: null, label: t('screens.discover.fotoIzAnkety') }, null);
      if (!r) { swipe.current?.reset(); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (r.status === 'match') router.push('/match');
      else toast(t('screens.discover.iskraOtpravlena'));
    } catch { swipe.current?.reset(); router.push('/error-retry'); }
  };
  const doPass = async (flung: boolean) => {
    if (!flung) await swipe.current?.fling('left');
    try { await d.pass(); } catch { swipe.current?.reset(); router.push('/error-retry'); }
  };
  // Undo of the last pass is available to everyone.
  const onUndo = async () => {
    try { toast((await d.undoPass()) ? t('screens.discover.posledniyPropuskVosstanovl') : t('screens.discover.nechegoVosstanavlivat')); }
    catch { router.push('/error-retry'); }
  };
  const onComment = () => {
    if (!card) return;
    d.setTarget({ kind: 'profile', ref: null, label: t('screens.discover.fotoIzAnkety') });
    router.push('/like-note');
  };

  // The server hides dating from people who are not single; say why instead of showing an empty feed.
  if (modes && !modes.dating_open) return <Redirect href={modes.status === 'couple' ? '/couples' : '/company'} />;

  let body: React.ReactNode;
  if (d.pending && !card) body = <LoadingCards />;
  else if (d.error?.kind === 'offline') body = <OfflineState onRetry={d.load} />;
  else if (d.error) body = <ErrorRetryState onRetry={d.load} />;
  else if (!card) body = (
    <>
      <EmptyDiscover />
      <LinkBtn center label={t('screens.discover.otmenitPosledniyPropusk')} onPress={onUndo} />
    </>
  );
  else {
    body = (
      <>
        <SwipeCard key={card.profile_id} ref={swipe} labels={{ left: t('screens.discover.stampPass'), right: t('screens.discover.stampSpark') }}
          onSwipe={(dir) => { void (dir === 'right' ? doSpark(true) : doPass(true)); }}>
          <ProfileHero fill photos={card.photos} count={card.photos.length} verified={card.verified}
            name={card.display_name} age={card.age} sub={`${card.city} · ${card.distance}`}
            label={t('screens.discover.portretDisplayName', { display_name: card.display_name })}
            onOpen={() => openProfile(card)} openLabel={t('screens.discover.openProfile')} />
        </SwipeCard>
        {/* Outside the swipe area: the chip line scrolls sideways itself. */}
        <ProfileMeta compact card={card}
          extra={<>
            {card.seen ? <Chip tone="amber" label={t('screens.discover.seenBefore')} /> : null}
            {common.length ? <Chip tone="green" icon="heart" label={t('screens.discover.obscheeV', { common: common.map((x) => interestLabel(t, x)).join(', ').toLowerCase() })} /> : null}
          </>} />
        <ActionSet onPass={() => { void doPass(false); }} onComment={onComment} onSpark={() => { void doSpark(false); }} onProfile={() => openProfile(card)} />
      </>
    );
  }

  return (
    <Screen tabs="discover" scroll={false}>
      <PeopleHead active="discover" extra={card ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('screens.discover.otmenitPosledniyPropusk')} onPress={onUndo} hitSlop={8} style={st.undo}>
          <Text style={st.undoText}>↶</Text>
        </Pressable>
      ) : null} />
      {/* Only when it matters: the daily limit is close. */}
      {card && left <= 3 ? <Tiny>{t('screens.discover.vIzLimitLaykov', { left, limit })}</Tiny> : null}
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  undo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  undoText: { fontSize: 20, color: colors.redDark, fontWeight: '700' },
});
