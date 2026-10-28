import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, LinkBtn, Screen, Tiny, Title, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const SUGGESTED = ['screens.openingMoves.kudaByVySbezhali', 'screens.openingMoves.kofeProgulkaIliMuzey', 'screens.openingMoves.kakoeMestoStoitPokazat'] as const;

// 67 · Темы для первого шага
export default function OpeningMoves() {
  const { t } = useLang();
  const toast = useToast();
  const { session } = useSession();
  const uid = session?.user.id;
  const [moves, setMoves] = useState<string[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!uid) return;
    supabase.from('opening_moves').select('text, position').eq('profile_id', uid).order('position')
      .then(({ data }) => setMoves(data?.length ? data.map((d) => d.text) : SUGGESTED.map((k) => t(k))));
  }, [uid]);
  const add = () => {
    if (moves.length >= 3) { toast(t('screens.openingMoves.mozhnoDobavitDoTreh')); return; }
    setMoves([...moves, '']); setEditing(moves.length);
  };
  const save = async () => {
    if (!uid) return;
    const clean = moves.map((m) => m.trim()).filter((m) => m.length >= 3).slice(0, 3);
    setBusy(true);
    try {
      await supabase.from('opening_moves').delete().eq('profile_id', uid);
      if (clean.length) {
        const { error } = await supabase.from('opening_moves').insert(clean.map((text, position) => ({ profile_id: uid, text, position })));
        if (error) throw error;
      }
      toast(t('screens.openingMoves.izmeneniyaSohraneny')); router.navigate('/me');
    } catch { toast(t('screens.openingMoves.neUdalosSohranit')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.openingMoves.pervyyShag')} heading={t('screens.openingMoves.vashiTemyDlyaNachala')} sub={t('screens.openingMoves.podskazkiSnimayutNelovkost')} />
      {moves.map((m, i) => (
        <Choice key={i}>
          <View style={{ flex: 1 }}>
            {editing === i ? (
              <TextInput autoFocus value={m} onChangeText={(txt) => setMoves(moves.map((x, j) => (j === i ? txt : x)))} onBlur={() => setEditing(null)} maxLength={140} style={{ fontSize: 12, fontWeight: '700', color: colors.ink }} accessibilityLabel={t('screens.openingMoves.tema')} />
            ) : <Text style={{ fontSize: 12, fontWeight: '700' }}>{m || t('screens.openingMoves.novayaTema')}</Text>}
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{i === 0 ? t('screens.openingMoves.pokazyvaetsyaVNovyhSovpade') : t('screens.openingMoves.mozhnoIzmenitVLyuboe')}</Text>
          </View>
          <LinkBtn label={editing === i ? t('screens.openingMoves.gotovo') : t('screens.openingMoves.izm')} onPress={() => setEditing(editing === i ? null : i)} />
        </Choice>
      ))}
      <Choice onPress={add}><Text style={{ fontSize: 12 }}>{t('screens.openingMoves.svoyaTemaIliFoto')}</Text></Choice>
      <Btn label={t('screens.openingMoves.sohranitTemy')} busy={busy} onPress={save} />
      <Tiny>{t('screens.openingMoves.nachniteSTemyKotoraya')}</Tiny>
    </Screen>
  );
}
