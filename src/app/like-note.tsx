import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, BackLink, Btn, Card, Field, Row, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDiscover } from '@/lib/discover';
import { useProfileCard } from '@/hooks/useProfileCard';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useSparkLimit } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 28 · Лайк с комментарием
export default function LikeNote() {
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const d = useDiscover();
  const toast = useToast();
  const limit = useSparkLimit();
  const { data: fetched } = useProfileCard(id ?? null);
  const card = (id ? fetched : d.current) ?? d.current;
  const photo = useSignedUrl(card?.photos[0]?.path);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (withComment: boolean) => {
    if (!card) return;
    if (d.likesUsed >= limit) { router.replace('/like-limit'); return; }
    setBusy(true);
    try {
      const r = await d.spark(card, d.target, withComment ? comment.trim() || null : null);
      if (!r) return;
      toast(t('screens.likeNote.laykOtpravlen'));
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
      <Title kicker={t('screens.likeNote.tochechnyyInteres')} heading={t('screens.likeNote.chtoImennoVamPonravilos')} sub={t('screens.likeNote.reaktsiyaNaFotoIli')} />
      <Card style={{ padding: 9 }}>
        <Row><Avatar uri={photo} /><Text style={{ fontSize: 10, color: '#8f8c84', flex: 1 }}>{d.target.label}</Text></Row>
      </Card>
      <Field label={t('screens.likeNote.kommentariyNeobyazatelno')} value={comment} onChangeText={setComment} multiline maxLength={280} style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.likeNote.napishiteOdnuZhivuyuMysl')} />
      <Btn label={t('screens.likeNote.otpravitIskruSKommentariem')} busy={busy} disabled={!card} onPress={() => send(true)} />
      <Btn kind="tertiary" label={t('screens.likeNote.otpravitBezKommentariya')} disabled={!card || busy} onPress={() => send(false)} />
      <Tiny>{t('screens.likeNote.kommentariyViditTolkoAdres')}</Tiny>
    </Screen>
  );
}
