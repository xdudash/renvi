import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, BackLink, Btn, Card, Field, Row, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDiscover } from '@/lib/discover';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useTierLimits } from '@/lib/session';

// 28 · Лайк с комментарием
export default function LikeNote() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const d = useDiscover();
  const toast = useToast();
  const { limits } = useTierLimits();
  const { data: fetched } = useProfileCard(id ?? null);
  const card = (id ? fetched : d.current) ?? d.current;
  const photo = useSignedUrl(card?.photos[0]?.path);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (withComment: boolean) => {
    if (!card) return;
    if (d.likesUsed >= Number(limits?.daily_likes ?? 20)) { router.replace('/like-limit'); return; }
    setBusy(true);
    try {
      const r = await d.spark(card, d.target, withComment ? comment.trim() || null : null);
      if (!r) return;
      toast('Лайк отправлен');
      router.replace(r.status === 'match' ? '/match' : '/discover');
    } catch {
      router.push('/error-retry');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="ТОЧЕЧНЫЙ ИНТЕРЕС" heading={'Что именно\nвам понравилось?'} sub="Реакция на фото или ответ помогает начать с личного, а не с «привет»." />
      <Card style={{ padding: 9 }}>
        <Row><Avatar uri={photo} /><Text style={{ fontSize: 10, color: '#8f8c84', flex: 1 }}>{d.target.label}</Text></Row>
      </Card>
      <Field label="КОММЕНТАРИЙ · НЕОБЯЗАТЕЛЬНО" value={comment} onChangeText={setComment} multiline maxLength={280} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Напишите одну живую мысль…" />
      <Btn label="Отправить искру с комментарием" busy={busy} disabled={!card} onPress={() => send(true)} />
      <Btn kind="tertiary" label="Отправить без комментария" disabled={!card || busy} onPress={() => send(false)} />
      <Tiny>Комментарий видит только адресат. Уважайте границы и избегайте личных данных.</Tiny>
    </Screen>
  );
}
