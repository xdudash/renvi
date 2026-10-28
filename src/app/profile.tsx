import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionSet, BackLink, Card, Chip, Eyebrow, IconButton, LinkBtn, Loading, PromptCard, Row, Screen, StateBlock, useToast } from '@/components/ui';
import { MediaThumb, ProfileHero, ProfileMeta } from '@/components/Profile';
import { ErrorRetryState } from '@/components/States';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useDiscover } from '@/lib/discover';
import { useSession, useTierLimits } from '@/lib/session';
import { intentChip } from '@/lib/catalog';
import { colors } from '@/theme/tokens';

// 26 · Полная анкета
export default function Profile() {
  const params = useLocalSearchParams<{ id?: string; self?: string }>();
  const { session } = useSession();
  const id = params.self ? session?.user.id : params.id;
  const isSelf = !!params.self || id === session?.user.id;
  const { data: card, loading, error, reload } = useProfileCard(id);
  const d = useDiscover();
  const toast = useToast();
  const { limits } = useTierLimits();

  if (loading) return <Screen><BackLink /><Loading /></Screen>;
  if (error) return <Screen><BackLink /><ErrorRetryState onRetry={reload} /></Screen>;
  if (!card) return <Screen><BackLink /><StateBlock icon="↗" title="Профиль недоступен" copy="Анкета скрыта или больше не показывается." label="К знакомствам" onPress={() => router.navigate('/discover')} /></Screen>;

  const onSpark = async () => {
    if (d.likesUsed >= Number(limits?.daily_likes ?? 20)) { router.push('/like-limit'); return; }
    try {
      const r = await d.spark(card, { kind: 'profile', ref: null, label: 'Фото из анкеты' }, null);
      if (!r) return;
      toast('Искра отправлена');
      router.replace(r.status === 'match' ? '/match' : '/discover');
    } catch { router.push('/error-retry'); }
  };
  const prompt = card.prompts[0];
  const rest = card.photos.slice(1, 4);

  return (
    <Screen>
      <BackLink />
      <ProfileHero path={card.photos[0]?.path} count={card.photos.length} verified={card.verified} label={`Фото профиля ${card.display_name}`} overlay={`Фото　1 / ${card.photos.length}　›`} />
      <ProfileMeta card={card} />
      {card.bio ? (<View><Text style={st.section}>О человеке</Text><Text style={st.lede}>{card.bio}</Text></View>) : null}
      {card.interests.length ? (
        <View>
          <Text style={st.section}>Общие интересы</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{card.interests.map((x) => <Chip key={x} label={x} tone="red" />)}</View>
        </View>
      ) : null}
      {rest.length ? (
        <View style={{ flexDirection: 'row', gap: 7, marginVertical: 12 }}>
          {rest.map((p, i) => <MediaThumb key={p.id} path={p.path} video={p.kind === 'video'} onPress={() => router.push({ pathname: '/media-viewer', params: { id: card.profile_id, at: String(i + 1) } })} />)}
        </View>
      ) : null}
      {prompt ? <PromptCard question={prompt.question} answer={prompt.answer} onReply={isSelf ? undefined : () => { d.setTarget({ kind: 'prompt', ref: prompt.id ?? null, label: `Ответ: ${prompt.answer}` }); router.push({ pathname: '/like-note', params: { id: card.profile_id } }); }} /> : null}
      {card.music_title ? (
        <Card>
          <Eyebrow>МУЗЫКА СЕЙЧАС</Eyebrow>
          <Row style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 22, color: colors.red }}>♫</Text>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13 }}>{card.music_title}</Text><Text style={st.sub}>Открыть фрагмент</Text></View>
            <IconButton label="Открыть фрагмент" text="▶" onPress={() => card.music_url ? Linking.openURL(card.music_url) : toast('Ссылка на трек не добавлена')} />
          </Row>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={st.tile}><Eyebrow>ЦЕЛЬ</Eyebrow><Text style={st.bold}>{intentChip(card.intent)}</Text></View>
        <View style={st.tile}><Eyebrow>ЛОКАЦИЯ</Eyebrow><Text style={st.bold}>{card.city} · {card.distance}</Text></View>
      </View>
      {isSelf ? null : (
        <>
          <ActionSet
            onPass={async () => { try { await d.pass(); } catch {} toast('Профиль пропущен'); router.replace('/discover'); }}
            onComment={() => { d.setTarget({ kind: 'profile', ref: null, label: 'Фото из анкеты' }); router.push({ pathname: '/like-note', params: { id: card.profile_id } }); }}
            onSpark={onSpark}
          />
          <LinkBtn label="⋯ Пожаловаться или заблокировать" onPress={() => router.push({ pathname: '/safety', params: { profile: card.profile_id } })} />
        </>
      )}
    </Screen>
  );
}

const st = {
  section: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -1, color: colors.ink, marginTop: 23, marginBottom: 8 },
  lede: { fontSize: 13, lineHeight: 20, color: colors.sub },
  sub: { fontSize: 10, color: colors.sub, marginTop: 3 },
  bold: { fontSize: 13, fontWeight: '700' as const, color: colors.ink },
  tile: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 17, padding: 12 },
};
