import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Field, IconButton, Row, Screen, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { resolveSpotify } from '@/lib/account';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 68 · Музыка в профиле
export default function EditMusic() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const v = input.trim();
    if (!v) { toast(t('screens.editMusic.vstavteSsylkuSpotifyIli')); return; }
    setBusy(true);
    try {
      const isLink = v.startsWith('https://');
      const title = isLink ? await resolveSpotify(v) : v;
      if (isLink && !title) { toast(t('screens.editMusic.neUdalosRaspoznatSsylku')); return; }
      await api.saveOnboarding({ music_title: title, music_url: isLink ? v : '' });
      await refresh(); setInput(''); toast(t('screens.editMusic.izmeneniyaSohraneny')); router.navigate('/me');
    } catch { toast(t('screens.editMusic.neUdalosSohranit')); } finally { setBusy(false); }
  };
  const removeTrack = async () => {
    try { await api.saveOnboarding({ music_title: '', music_url: '' }); await refresh(); toast(t('screens.editMusic.trekUbran')); } catch { toast(t('screens.editMusic.neUdalosUbratTrek')); }
  };
  const has = !!profile?.music_title;
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.editMusic.muzyka')} heading={t('screens.editMusic.trekBystryyObschiyYazyk')} sub={t('screens.editMusic.dobavteOdnuPesnyuIz')} />
      <Field label={t('screens.editMusic.ssylkaIliNazvanie')} value={input} onChangeText={setInput} autoCapitalize="none" placeholder={t('screens.editMusic.spotifyLinkIliNazvanie')} />
      {has ? (
        <Card>
          <Row>
            <Text style={{ fontSize: 28, color: colors.red }}>♫</Text>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13 }}>{profile?.music_title}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.editMusic.dobavlenVProfil')}</Text></View>
            <IconButton label={t('screens.editMusic.predprosmotr')} text="▶" onPress={() => (profile?.music_url ? Linking.openURL(profile.music_url) : toast(t('screens.editMusic.predprosmotrDostupenDlyaSs')))} />
          </Row>
        </Card>
      ) : null}
      <Btn label={t('screens.editMusic.sohranitMuzyku')} busy={busy} onPress={save} />
      {has ? <Btn kind="ghost" label={t('screens.editMusic.ubratTrek')} onPress={removeTrack} /> : null}
    </Screen>
  );
}
