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
import { useLang } from '@/lib/lang';

// 24 · Готово · профиль создан
export default function ObDone() {
  const { t } = useLang();
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
      toast(m.includes('photos') ? t('screens.obDone.dobavteMinimum2Foto') : m.includes('consents') ? t('screens.obDone.podtverditeVozrastUsloviya') : m.includes('incomplete') ? t('screens.obDone.zapolniteImyaDatuRozhdeniy') : t('screens.obDone.neUdalosOpublikovatAnketu'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title kicker={t('screens.obDone.gotovo')} heading={t('screens.obDone.anketaVyglyaditKakVy')} sub={t('screens.obDone.proverteDetaliPrezhdeChem')} />
      <Card>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile?self=1')} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 }}>
          <Avatar uri={items[0]?.url} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{profile?.display_name ?? ''}{profile?.age ? `, ${profile.age}` : ''}</Text>
            <Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>{t('screens.obDone.predprosmotrAnketyV', { intent: intentChip(profile?.intent) })}</Text>
          </View>
          <Text style={{ color: '#aaa' }}>›</Text>
        </Pressable>
        <Meter value={pct} />
        <Tiny>{t('screens.obDone.profilZapolnenNaPct', { pct })}</Tiny>
      </Card>
      <Btn label={t('screens.obDone.pereytiKZnakomstvam')} busy={busy} onPress={() => publish('/discover')} />
      <Btn kind="ghost" label={t('screens.obDone.posmotretProfil')} onPress={() => publish('/me')} />
    </Screen>
  );
}
