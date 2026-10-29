import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ActionSet, Between, Chip, Eyebrow, LinkBtn, SafeBanner, Screen, Tiny, useToast } from '@/components/ui';
import { DetailsGrid, ProfileHero, ProfileMeta, StoryBody } from '@/components/Profile';
import { EmptyDiscover, ErrorRetryState, OfflineState } from '@/components/States';
import { LoadingCards } from '@/components/LoadingCards';
import { useDiscover } from '@/lib/discover';
import { useSession, useSparkLimit } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { interestLabel } from '@/lib/catalog';

// 25 · Главная карточка
export default function Discover() {
  const { t } = useLang();
  const toast = useToast();
  const d = useDiscover();
  const { profile } = useSession();
  const limit = useSparkLimit();
  useEffect(() => { d.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = d.current;
  const mine: string[] = profile?.interests ?? [];
  const common = card ? card.interests.filter((x) => mine.includes(x)) : [];

  const onSpark = async () => {
    if (!card) return;
    if (d.likesUsed >= limit) { router.push('/like-limit'); return; }
    try {
      const r = await d.spark(card, { kind: 'profile', ref: null, label: t('screens.discover.fotoIzAnkety') }, null);
      if (!r) return;
      toast(t('screens.discover.iskraOtpravlena'));
      if (r.status === 'match') router.push('/match');
    } catch { router.push('/error-retry'); }
  };
  const onPass = async () => {
    try { await d.pass(); toast(t('screens.discover.profilPropuschen')); } catch { router.push('/error-retry'); }
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
        <Between style={{ marginBottom: 4 }}>
          <Tiny>{t('screens.discover.vIzLimitLaykov', { left: Math.max(0, limit - d.likesUsed), limit })}</Tiny>
          <Tiny>{t('screens.discover.zatsepiloNachniteSOtveta')}</Tiny>
        </Between>
        <ProfileHero key={card.profile_id} photos={card.photos} count={card.photos.length} verified={card.verified}
          name={card.display_name} age={card.age} sub={`${card.city} · ${card.distance}`}
          label={t('screens.discover.portretDisplayName', { display_name: card.display_name })} />
        <ProfileMeta card={card} />
        {common.length ? <View style={{ flexDirection: 'row' }}><Chip tone="green" icon="🤝" label={t('screens.discover.obscheeV', { common: common.map((x) => interestLabel(t, x)).join(', ').toLowerCase() })} /></View> : null}
        <ActionSet onPass={onPass} onComment={onComment} onSpark={onSpark} onProfile={() => router.push({ pathname: '/profile', params: { id: card.profile_id } })} />
        <LinkBtn label={t('screens.discover.otmenitPosledniyPropusk')} onPress={onUndo} />
        <StoryBody card={card}
          onReply={(prompt) => { d.setTarget({ kind: 'prompt', ref: prompt.id ?? null, label: t('screens.discover.otvetAnswer', { answer: prompt.answer }) }); router.push('/like-note'); }}
          onPhoto={(at) => router.push({ pathname: '/media-viewer', params: { id: card.profile_id, at: String(at) } })} />
        <DetailsGrid details={card.details} />
        {/* End of the profile: decide here too, without scrolling back up. */}
        {card.prompts.length + card.photos.length > 2 ? <ActionSet onPass={onPass} onComment={onComment} onSpark={onSpark} /> : null}
        <SafeBanner>{t('screens.discover.rasstoyanieOkruglenoTochny')}</SafeBanner>
      </>
    );
  }

  return (
    <Screen tabs="discover" key={card?.profile_id ?? 'none'}>
      <Between style={{ marginTop: 1, marginBottom: 5 }}>
        <Eyebrow>{t('screens.discover.segodnyaVV', { city: (profile?.city ?? '').toUpperCase() })}</Eyebrow>
        <LinkBtn label={t('screens.discover.filtry')} icon="filter" onPress={() => router.push('/filters')} />
      </Between>
      {body}
    </Screen>
  );
}
