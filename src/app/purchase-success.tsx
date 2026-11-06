import { router } from 'expo-router';
import { Screen, StateBlock } from '@/components/ui';
import { useMyTier } from '@/lib/tier';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
import { Text } from 'react-native';

// purchase-success · the server confirmed Plus (my_tier() says so), not just the App Store.
export default function PurchaseSuccess() {
  const { t } = useLang();
  const { tier } = useMyTier();
  return (
    <Screen>
      <StateBlock
        icon="✓"
        title={t('purchase.ok.title')}
        copy={t('purchase.ok.copy')}
        label={t('purchase.ok.back')}
        onPress={() => router.replace('/me')}
        secondary={tier?.plus && tier.trial && tier.expires_at ? <Text style={{ fontSize: 11, color: colors.sub, textAlign: 'center' }}>{t('purchase.ok.trial', { n: Math.max(1, Math.round((Date.parse(tier.expires_at) - Date.now()) / 86400000)) })}</Text> : null}
      />
    </Screen>
  );
}
