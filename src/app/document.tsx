import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BackLink, Screen, Title } from '@/components/ui';
import { OperatorInfo } from '@/components/OperatorInfo';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';

// In-app documents: the plain-language versions that ship with the app (used when no hosted link is configured).
const SECTIONS = { privacy: 7, terms: 8, moderation: 5 } as const;
type Doc = keyof typeof SECTIONS;
const isDoc = (v: unknown): v is Doc => typeof v === 'string' && v in SECTIONS;

// 74a · Документ
export default function DocumentScreen() {
  const { t } = useLang();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const key: Doc = isDoc(doc) ? doc : 'privacy';
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.legal.dokumenty')} heading={t(`doc.${key}.title` as TranslationKey)} sub={t(`doc.${key}.sub` as TranslationKey)} />
      {Array.from({ length: SECTIONS[key] }, (_, i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>{t(`doc.${key}.h${i + 1}` as TranslationKey)}</Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.sub }}>{t(`doc.${key}.b${i + 1}` as TranslationKey)}</Text>
        </View>
      ))}
      <OperatorInfo />
    </Screen>
  );
}
