import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ActionSet, Between, Chip, Eyebrow, LinkBtn, PromptCard, SafeBanner, Screen, Tiny, useToast } from '@/components/ui';
import { ProfileHero, ProfileMeta } from '@/components/Profile';
import { EmptyDiscover, ErrorRetryState, OfflineState } from '@/components/States';
import { LoadingCards } from '@/components/LoadingCards';
import { useDiscover } from '@/lib/discover';
import { useSession, useTierLimits } from '@/lib/session';

// 25 · Главная карточка
export default function Discover() {
  const toast = useToast();
  const d = useDiscover();
  const { profile } = useSession();
  const { tier, limits } = useTierLimits();
  const limit = Number(limits?.daily_likes ?? 20);
  useEffect(() => { d.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = d.current;
  const mine: string[] = profile?.interests ?? [];
  const common = card ? card.interests.filter((x) => mine.includes(x)) : [];

  const onSpark = async () => {
    if (!card) return;
    if (d.likesUsed >= limit) { router.push('/like-limit'); return; }
    try {
      const r = await d.spark(card, { kind: 'profile', ref: null, label: 'Фото из анкеты' }, null);
      if (!r) return;
      toast('Искра отправлена');
      if (r.status === 'match') router.push('/match');
    } catch { router.push('/error-retry'); }
  };
  const onPass = async () => {
    try { await d.pass(); toast('Профиль пропущен'); } catch { router.push('/error-retry'); }
  };
  const onComment = () => {
    if (!card) return;
    d.setTarget({ kind: 'profile', ref: null, label: 'Фото из анкеты' });
    router.push('/like-note');
  };

  let body: React.ReactNode;
  if (d.loading && !card) body = <LoadingCards />;
  else if (d.error?.kind === 'offline') body = <OfflineState onRetry={d.load} />;
  else if (d.error) body = <ErrorRetryState onRetry={d.load} />;
  else if (!card) body = (
    <>
      <EmptyDiscover />
      {tier !== 'free' ? <LinkBtn center label="↶ Отменить последний пропуск" onPress={async () => { try { toast((await d.undoPass()) ? 'Последний пропуск восстановлен' : 'Нечего восстанавливать'); } catch { toast('Доступно в RENVI Plus'); } }} /> : null}
    </>
  );
  else {
    const prompt = card.prompts[0];
    body = (
      <>
        <Between style={{ marginBottom: 8 }}>
          <Tiny>{Math.max(0, limit - d.likesUsed)} из {limit} лайков осталось</Tiny>
          <Tiny>Зацепило? Начните с ответа.</Tiny>
        </Between>
        <ProfileHero path={card.photos[0]?.path} count={card.photos.length} verified={card.verified} label={`Портрет ${card.display_name}`} />
        <ProfileMeta card={card} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {card.interests.map((x, i) => <Chip key={x} label={x} tone={i === 0 ? 'red' : 'plain'} />)}
          {common.length ? <Chip label={`Общее: ${common.join(', ').toLowerCase()}`} /> : null}
        </View>
        <ActionSet onPass={onPass} onComment={onComment} onSpark={onSpark} onProfile={() => router.push({ pathname: '/profile', params: { id: card.profile_id } })} />
        {tier !== 'free' ? (
          <LinkBtn label="↶ Отменить последний пропуск" onPress={async () => { try { toast((await d.undoPass()) ? 'Последний пропуск восстановлен' : 'Нечего восстанавливать'); } catch { toast('Доступно в RENVI Plus'); } }} />
        ) : null}
        {prompt ? (
          <PromptCard question={prompt.question} answer={prompt.answer} onReply={() => { d.setTarget({ kind: 'prompt', ref: prompt.id ?? null, label: `Ответ: ${prompt.answer}` }); router.push('/like-note'); }} />
        ) : null}
        <SafeBanner>Расстояние округлено. Точные координаты не показываются.</SafeBanner>
      </>
    );
  }

  return (
    <Screen tabs="discover">
      <Between style={{ marginTop: 1, marginBottom: 5 }}>
        <Eyebrow>СЕГОДНЯ В {(profile?.city ?? '').toUpperCase()}</Eyebrow>
        <LinkBtn label="Фильтры" icon="filter" onPress={() => router.push('/filters')} />
      </Between>
      {body}
    </Screen>
  );
}
