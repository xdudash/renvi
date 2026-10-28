import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Screen, Title } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 76 · Удалить аккаунт
export default function DeleteAccount() {
  const { t } = useLang();
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.deleteAccount.udalenieAkkaunta')} heading={t('screens.deleteAccount.vyUverenyChtoHotite')} sub={t('screens.deleteAccount.snachalaMozhnoSkrytAnketu')} />
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.deleteAccount.priUdalenii')}</Text>
        <View style={{ marginTop: 6, gap: 4 }}>
          {[t('screens.deleteAccount.anketaPerestanetPokazyvats'), t('screens.deleteAccount.pokupkaVAppStore'), t('screens.deleteAccount.srokiUdaleniyaDannyhUkazan')].map((x) => (
            <Text key={x} style={{ fontSize: 10, color: colors.muted }}>•  {x}</Text>
          ))}
        </View>
      </Card>
      <Btn kind="tertiary" label={t('screens.deleteAccount.snachalaSkrytProfil')} onPress={() => router.push('/privacy-visibility')} />
      <Btn kind="warn" label={t('screens.deleteAccount.prodolzhitUdalenie')} onPress={() => router.push('/delete-confirm')} />
    </Screen>
  );
}
