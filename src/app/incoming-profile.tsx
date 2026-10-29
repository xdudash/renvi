import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, HoldButton, Loading, Screen, StateBlock, useToast } from '@/components/ui';
import { DetailsGrid, ProfileHero, ProfileMeta, StoryBody } from '@/components/Profile';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useDiscover } from '@/lib/discover';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';

// 38 · Профиль из входящего лайка
export default function IncomingProfile() {
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: card, loading } = useProfileCard(id);
  const d = useDiscover();
  const toast = useToast();
  if (loading) return <Screen tabs="likes"><BackLink /><Loading /></Screen>;
  if (!card) return <Screen tabs="likes"><BackLink /><StateBlock icon="↗" title={t('screens.incomingProfile.unavailable')} copy={t('screens.incomingProfile.unavailableCopy')} label={t('screens.incomingProfile.toSparks')} onPress={() => router.navigate('/likes')} /></Screen>;
  const mutual = async () => {
    try {
      const r = await d.spark(card, { kind: 'profile', ref: null, label: t('screens.incomingProfile.photoFromProfile') }, null);
      if (!r) return;
      router.replace(r.status === 'match' ? '/match' : '/likes');
    } catch { router.push('/error-retry'); }
  };
  return (
    <Screen tabs="likes">
      <BackLink onPress={() => router.navigate('/likes')} />
      <ProfileHero photos={card.photos} count={card.photos.length} verified={card.verified} overlay={t('screens.incomingProfile.overlay')}
        name={card.display_name} age={card.age} sub={`${card.city} · ${card.distance}`}
        label={t('screens.incomingProfile.portrait', { name: card.display_name })} />
      <ProfileMeta card={card} />
      <HoldButton label={t('screens.incomingProfile.hold')} onComplete={mutual} />
      <StoryBody card={card} onPhoto={(at) => router.push({ pathname: '/media-viewer', params: { id: card.profile_id, at: String(at) } })} />
      <DetailsGrid details={card.details} />
      <HoldButton label={t('screens.incomingProfile.hold')} onComplete={mutual} />
      <Btn kind="ghost" label={t('screens.incomingProfile.skip')} onPress={async () => { try { await api.pass(card.profile_id); toast(t('screens.incomingProfile.skipped')); } catch {} router.navigate('/likes'); }} />
    </Screen>
  );
}
