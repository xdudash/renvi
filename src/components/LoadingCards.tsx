import { View } from 'react-native';
import { Card, Meter, Tiny } from './ui';
import { useLang } from '@/lib/lang';

// Skeleton used while profiles load ("Загрузка" state).
export function LoadingCards() {
  const { t } = useLang();
  return (
    <View accessibilityLabel={t('components.loadingCards.label')}>
      <View style={{ height: 300, borderRadius: 24, backgroundColor: '#EAE6E0', marginVertical: 7 }} />
      <Card><Meter value={42} /><Tiny>{t('components.loadingCards.text')}</Tiny></Card>
    </View>
  );
}
