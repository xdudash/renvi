import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Btn, Card, Meter, Screen, Tiny, Title, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useMyPhotos } from '@/hooks/usePhotos';
import { useMyPrompts } from '@/hooks/usePrompts';
import { completeness } from '@/lib/completeness';
import { intentChip } from '@/lib/catalog';

// 24 · Готово · профиль создан
export default function ObDone() {
  const toast = useToast();
  const { profile, refresh } = useSession();
  const { items } = useMyPhotos();
  const { items: prompts } = useMyPrompts();
  const [busy, setBusy] = useState(false);
  const pct = completeness(profile, items.length, prompts.length);
  const publish = async (to: string) => {
    setBusy(true);
    try {
      await api.publish();
      await refresh();
      router.replace(to as never);
    } catch (e: any) {
      const m = String(e?.message ?? '');
      toast(m.includes('photos') ? 'Добавьте минимум 2 фото' : m.includes('consents') ? 'Подтвердите возраст, Условия и согласие' : m.includes('incomplete') ? 'Заполните имя, дату рождения и город' : 'Не удалось опубликовать анкету');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title kicker="ГОТОВО" heading={'Анкета выглядит\nкак вы.'} sub="Проверьте детали, прежде чем показать профиль людям." />
      <Card>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile?self=1')} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 }}>
          <Avatar uri={items[0]?.url} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{profile?.display_name ?? ''}{profile?.age ? `, ${profile.age}` : ''}</Text>
            <Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>Предпросмотр анкеты · {intentChip(profile?.intent)}</Text>
          </View>
          <Text style={{ color: '#aaa' }}>›</Text>
        </Pressable>
        <Meter value={pct} />
        <Tiny>Профиль заполнен на {pct}% · можно улучшить позже</Tiny>
      </Card>
      <Btn label="Перейти к знакомствам" busy={busy} onPress={() => publish('/discover')} />
      <Btn kind="ghost" label="Посмотреть профиль" onPress={() => publish('/me')} />
    </Screen>
  );
}
