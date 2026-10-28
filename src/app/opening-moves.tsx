import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, LinkBtn, Screen, Tiny, Title, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

const SUGGESTED = ['Куда бы вы сбежали на выходные?', 'Кофе, прогулка или музей?', 'Какое место стоит показать в вашем городе?'];

// 67 · Темы для первого шага
export default function OpeningMoves() {
  const toast = useToast();
  const { session } = useSession();
  const uid = session?.user.id;
  const [moves, setMoves] = useState<string[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!uid) return;
    supabase.from('opening_moves').select('text, position').eq('profile_id', uid).order('position')
      .then(({ data }) => setMoves(data?.length ? data.map((d) => d.text) : SUGGESTED));
  }, [uid]);
  const add = () => {
    if (moves.length >= 3) { toast('Можно добавить до трёх тем'); return; }
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
      toast('Изменения сохранены'); router.navigate('/me');
    } catch { toast('Не удалось сохранить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="ПЕРВЫЙ ШАГ" heading="Ваши темы для начала" sub="Подсказки снимают неловкость в чате. Можно добавить до трёх — ответить на них может любой из вас." />
      {moves.map((m, i) => (
        <Choice key={i}>
          <View style={{ flex: 1 }}>
            {editing === i ? (
              <TextInput autoFocus value={m} onChangeText={(t) => setMoves(moves.map((x, j) => (j === i ? t : x)))} onBlur={() => setEditing(null)} maxLength={140} style={{ fontSize: 12, fontWeight: '700', color: colors.ink }} accessibilityLabel="Тема" />
            ) : <Text style={{ fontSize: 12, fontWeight: '700' }}>{m || 'Новая тема'}</Text>}
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{i === 0 ? 'Показывается в новых совпадениях' : 'Можно изменить в любое время'}</Text>
          </View>
          <LinkBtn label={editing === i ? 'Готово' : 'Изм.'} onPress={() => setEditing(editing === i ? null : i)} />
        </Choice>
      ))}
      <Choice onPress={add}><Text style={{ fontSize: 12 }}>＋ Своя тема или фото с подписью</Text></Choice>
      <Btn label="Сохранить темы" busy={busy} onPress={save} />
      <Tiny>Начните с темы, которая вам интересна. Сообщение отправляете только вы.</Tiny>
    </Screen>
  );
}
