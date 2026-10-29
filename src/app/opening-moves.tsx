import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, LinkBtn, Screen, Tiny, Title, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { ErrorRetryState } from '@/components/States';

const SUGGESTED = ['screens.openingMoves.kudaByVySbezhali', 'screens.openingMoves.kofeProgulkaIliMuzey', 'screens.openingMoves.kakoeMestoStoitPokazat'] as const;

// 67 · Темы для первого шага
export default function OpeningMoves() {
  const { t } = useLang();
  const toast = useToast();
  const { session } = useSession();
  const uid = session?.user.id;
  // null = nothing saved yet: the suggestions are derived from t() at render time, so `t` is not an effect dependency.
  const [saved, setSaved] = useState<string[] | null>(null);
  // 'loading' | 'ok' | 'error': before the saved topics are known, "save" would overwrite them with the suggestions.
  const [load, setLoad] = useState<{ uid: string | undefined; tick: number; state: 'ok' | 'error' } | null>(null);
  const [tick, setTick] = useState(0);
  const [edited, setMoves] = useState<string[] | null>(null);
  const moves = edited ?? saved ?? SUGGESTED.map((k) => t(k));
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase.from('opening_moves').select('text, position').eq('profile_id', uid).order('position')
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setLoad({ uid, tick, state: 'error' }); return; }
        setSaved(data?.length ? data.map((d) => d.text) : null);
        setLoad({ uid, tick, state: 'ok' });
      }, () => { if (alive) setLoad({ uid, tick, state: 'error' }); });
    return () => { alive = false; };
  }, [uid, tick]);
  const loadState = load && load.uid === uid && load.tick === tick ? load.state : 'loading';
  const add = () => {
    if (moves.length >= 3) { toast(t('screens.openingMoves.mozhnoDobavitDoTreh')); return; }
    setMoves([...moves, '']); setEditing(moves.length);
  };
  // One transaction (save_opening_moves, migration 0030): the old delete-then-insert ignored the delete's error and
  // lost all topics when the insert failed.
  const save = async () => {
    if (!uid || loadState !== 'ok') return;
    const clean = moves.map((m) => m.trim()).filter((m) => m.length >= 3).slice(0, 3);
    setBusy(true);
    try {
      const { error } = await supabase.rpc('save_opening_moves', { p_texts: clean });
      if (error) throw error;
      toast(t('screens.openingMoves.izmeneniyaSohraneny')); router.navigate('/me');
    } catch { toast(t('screens.openingMoves.neUdalosSohranit')); } finally { setBusy(false); }
  };
  if (loadState === 'error' && !edited) return <Screen tabs="me"><BackLink /><ErrorRetryState onRetry={() => setTick((n) => n + 1)} /></Screen>;
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
      <Btn label={t('screens.openingMoves.sohranitTemy')} busy={busy} disabled={loadState !== 'ok'} onPress={save} />
      <Tiny>{t('screens.openingMoves.nachniteSTemyKotoraya')}</Tiny>
    </Screen>
  );
}
