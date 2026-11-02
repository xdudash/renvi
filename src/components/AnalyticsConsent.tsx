import { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn } from './ui';
import { useAnalyticsConsent } from '@/lib/analytics';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// `compact` (onboarding): same text and choice, smaller type, so the step fits one screen without scrolling.
export function AnalyticsConsent({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const { enabled, loading, setConsent } = useAnalyticsConsent();
  const [error, setError] = useState(false);
  const [attempted, setAttempted] = useState<boolean | null>(null);
  const save = async () => {
    const target = error && attempted !== null ? attempted : !enabled;
    setAttempted(target); setError(false);
    try { await setConsent(target); } catch { setError(true); }
  };
  return (
    <View style={{ gap: compact ? 6 : 10, paddingVertical: compact ? 10 : 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: compact ? 15 : 18, fontWeight: '700', color: colors.ink }}>{t('analytics.consentTitle')}</Text>
      <Text style={{ color: colors.sub, fontSize: compact ? 12 : 14, lineHeight: compact ? 16 : 20 }}>{t('analytics.consentCopy')}</Text>
      <Text style={{ color: colors.ink, fontSize: compact ? 12 : 14 }}>{t(enabled ? 'analytics.consentOn' : 'analytics.consentOff')}</Text>
      <Btn kind="secondary" label={t(error ? 'adm.common.retry' : enabled ? 'analytics.disable' : 'analytics.enable')} onPress={() => { void save(); }} disabled={loading} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{t('analytics.saveError')}</Text> : null}
    </View>
  );
}
