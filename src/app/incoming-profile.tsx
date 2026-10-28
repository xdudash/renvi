import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, HoldButton, Loading, PromptCard, Screen, StateBlock, useToast } from '@/components/ui';
import { ProfileHero, ProfileMeta } from '@/components/Profile';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useDiscover } from '@/lib/discover';
import { api } from '@/lib/api';

// 38 · Профиль из входящего лайка
export default function IncomingProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: card, loading } = useProfileCard(id);
  const d = useDiscover();
  const toast = useToast();
  if (loading) return <Screen tabs="likes"><BackLink /><Loading /></Screen>;
  if (!card) return <Screen tabs="likes"><BackLink /><StateBlock icon="↗" title="Профиль недоступен" copy="Анкета скрыта или больше не показывается." label="К искрам" onPress={() => router.navigate('/likes')} /></Screen>;
  const prompt = card.prompts[0];
  const mutual = async () => {
    try {
      const r = await d.spark(card, { kind: 'profile', ref: null, label: 'Фото из анкеты' }, null);
      if (!r) return;
      router.replace(r.status === 'match' ? '/match' : '/likes');
    } catch { router.push('/error-retry'); }
  };
  return (
    <Screen tabs="likes">
      <BackLink onPress={() => router.navigate('/likes')} />
      <ProfileHero path={card.photos[0]?.path} count={card.photos.length} label={`Портрет ${card.display_name}`} overlay="✦ Эта искра — вам" />
      <ProfileMeta card={card} />
      {prompt ? <PromptCard question={prompt.question} answer={prompt.answer} /> : null}
      <HoldButton label="Удерживать для взаимной искры ✦" onComplete={mutual} />
      <Btn kind="ghost" label="Пропустить" onPress={async () => { try { await api.pass(card.profile_id); toast('Профиль пропущен'); } catch {} router.navigate('/likes'); }} />
    </Screen>
  );
}
