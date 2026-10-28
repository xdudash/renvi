import { Text, View } from 'react-native';
import { Btn, Card, Row, Screen, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { requestApproxLocation } from '@/lib/location';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 18 · Геолокация · по желанию
export default function ObLocation() {
  const { t } = useLang();
  const toast = useToast();
  const { save, busy } = useStepSave('ob-location');
  const allow = async () => {
    const loc = await requestApproxLocation().catch(() => null);
    if (!loc) { toast(t('screens.obLocation.denied')); save({ location_enabled: false }); return; }
    save({ lat: loc.lat, lng: loc.lng });
  };
  return (
    <Screen>
      <OnbHeader step={8} kicker={t('screens.obLocation.kicker')} heading={t('screens.obLocation.heading')} sub={t('screens.obLocation.sub')} />
      <Card>
        <Row>
          <Text style={{ fontSize: 25, color: colors.red }}>⌖</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.obLocation.approx')}</Text>
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.obLocation.approxNote')}</Text>
          </View>
        </Row>
      </Card>
      <Btn label={t('screens.obLocation.allow')} busy={busy} onPress={allow} />
      <Btn kind="ghost" label={t('screens.obLocation.skip')} onPress={() => save({ location_enabled: false })} />
    </Screen>
  );
}
