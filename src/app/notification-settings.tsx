import { Linking, Text } from 'react-native';
import { BackLink, Btn, Card, CheckRow, Screen, Title, useToast } from '@/components/ui';
import { usePrefs } from '@/hooks/usePrefs';
import { useTierLimits } from '@/lib/session';
import type { Prefs } from '@/lib/account';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 73 · Уведомления
export default function NotificationSettings() {
  const { t } = useLang();
  const toast = useToast();
  const { prefs, set } = usePrefs();
  const { limits } = useTierLimits();
  const canLikes = !!limits?.see_incoming;
  const rows: [keyof Prefs, string, string, boolean][] = [
    ['messages', t('screens.notificationSettings.soobscheniya'), t('screens.notificationSettings.kogdaPrihoditNovoeSoobsche'), true],
    ['matches', t('screens.notificationSettings.sovpadeniya'), t('screens.notificationSettings.kogdaIskraVzaimna'), true],
    ['dates', t('screens.notificationSettings.predlozhenieVstrechi'), t('screens.notificationSettings.otvetNaPriglashenie'), true],
    ['likes', t('screens.notificationSettings.novyeSimpatii'), t('screens.notificationSettings.tolkoEsliDostupnyVashemu'), canLikes],
    ['news', t('screens.notificationSettings.podborkiINovosti'), t('screens.notificationSettings.neChascheParyRaz'), true],
    ['digest_push', t('screens.notificationSettings.digestPush'), t('screens.notificationSettings.digestPushHint'), true],
    ['digest_email', t('screens.notificationSettings.digestEmail'), t('screens.notificationSettings.digestEmailHint'), true],
  ];
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.notificationSettings.uvedomleniya')} heading={t('screens.notificationSettings.ostavteTolkoVazhnoe')} sub={t('screens.notificationSettings.sistemnyeUvedomleniyaMozhn')} />
      <Card tight>
        {rows.map(([k, a, b, enabled]) => (
          <CheckRow key={k} disabled={!enabled} on={enabled && prefs[k]} onPress={() => set(k, !prefs[k]).catch(() => toast(t('screens.notificationSettings.neUdalosSohranit')))}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: enabled ? colors.ink : '#aaa' }}>{a}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{b}</Text>
          </CheckRow>
        ))}
      </Card>
      <Btn kind="ghost" label={t('screens.notificationSettings.otkrytNastroykiIos')} onPress={() => Linking.openSettings().catch(() => toast(t('screens.notificationSettings.otkroyteNastroykiTelefonaV')))} />
    </Screen>
  );
}
