import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Field, IconButton, Row, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { resolveSpotify } from '@/lib/account';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

// 68 · Музыка в профиле
export default function EditMusic() {
  const toast = useToast();
  const { profile, refresh } = useSession();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const v = input.trim();
    if (!v) { toast('Вставьте ссылку Spotify или название трека'); return; }
    setBusy(true);
    try {
      const isLink = v.startsWith('https://');
      const title = isLink ? await resolveSpotify(v) : v;
      if (isLink && !title) { toast('Не удалось распознать ссылку Spotify'); return; }
      await api.saveOnboarding({ music_title: title, music_url: isLink ? v : '' });
      await refresh(); setInput(''); toast('Изменения сохранены'); router.navigate('/me');
    } catch { toast('Не удалось сохранить'); } finally { setBusy(false); }
  };
  const removeTrack = async () => {
    try { await api.saveOnboarding({ music_title: '', music_url: '' }); await refresh(); toast('Трек убран'); } catch { toast('Не удалось убрать трек'); }
  };
  const has = !!profile?.music_title;
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="МУЗЫКА" heading="Трек — быстрый общий язык" sub="Добавьте одну песню из Spotify. В анкете открывается официальный предпросмотр." />
      <Field label="ССЫЛКА ИЛИ НАЗВАНИЕ" value={input} onChangeText={setInput} autoCapitalize="none" placeholder="Spotify link или название трека" />
      {has ? (
        <Card>
          <Row>
            <Text style={{ fontSize: 28, color: colors.red }}>♫</Text>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13 }}>{profile?.music_title}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Добавлен в профиль</Text></View>
            <IconButton label="Предпросмотр" text="▶" onPress={() => (profile?.music_url ? Linking.openURL(profile.music_url) : toast('Предпросмотр доступен для ссылок Spotify'))} />
          </Row>
        </Card>
      ) : null}
      <Btn label="Сохранить музыку" busy={busy} onPress={save} />
      {has ? <Btn kind="ghost" label="Убрать трек" onPress={removeTrack} /> : null}
    </Screen>
  );
}
