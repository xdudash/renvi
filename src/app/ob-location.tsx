import { Text, View } from 'react-native';
import { Btn, Card, Row, Screen, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { requestApproxLocation } from '@/lib/location';
import { colors } from '@/theme/tokens';

// 18 · Геолокация · по желанию
export default function ObLocation() {
  const toast = useToast();
  const { save, busy } = useStepSave('ob-location');
  const allow = async () => {
    const loc = await requestApproxLocation().catch(() => null);
    if (!loc) { toast('Доступ не дан — оставим только город'); save({ location_enabled: false }); return; }
    save({ lat: loc.lat, lng: loc.lng });
  };
  return (
    <Screen>
      <OnbHeader step={8} kicker="ТОЛЬКО ЕСЛИ УДОБНО" heading="Люди рядом" sub="Местоположение нужно только для расстояния. Можно выбрать город и продолжить без доступа к GPS." />
      <Card>
        <Row>
          <Text style={{ fontSize: 25, color: colors.red }}>⌖</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>Только примерное расстояние</Text>
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Координаты округляются примерно до 1 км.</Text>
          </View>
        </Row>
      </Card>
      <Btn label="Разрешить при использовании" busy={busy} onPress={allow} />
      <Btn kind="ghost" label="Продолжить без геолокации" onPress={() => save({ location_enabled: false })} />
    </Screen>
  );
}
