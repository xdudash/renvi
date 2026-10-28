import { Linking, Text } from 'react-native';
import { BackLink, Btn, Card, CheckRow, Screen, Title, useToast } from '@/components/ui';
import { usePrefs } from '@/hooks/usePrefs';
import { useTierLimits } from '@/lib/session';
import type { Prefs } from '@/lib/account';
import { colors } from '@/theme/tokens';

// 73 · Уведомления
export default function NotificationSettings() {
  const toast = useToast();
  const { prefs, set } = usePrefs();
  const { limits } = useTierLimits();
  const canLikes = !!limits?.see_incoming;
  const rows: [keyof Prefs, string, string, boolean][] = [
    ['messages', 'Сообщения', 'Когда приходит новое сообщение', true],
    ['matches', 'Совпадения', 'Когда искра взаимна', true],
    ['dates', 'Предложение встречи', 'Ответ на приглашение', true],
    ['likes', 'Новые симпатии', 'Только если доступны вашему плану', canLikes],
    ['news', 'Подборки и новости', 'Не чаще пары раз в месяц', true],
  ];
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="УВЕДОМЛЕНИЯ" heading="Оставьте только важное" sub="Системные уведомления можно отключить в настройках iOS." />
      <Card tight>
        {rows.map(([k, a, b, enabled]) => (
          <CheckRow key={k} disabled={!enabled} on={enabled && prefs[k]} onPress={() => set(k, !prefs[k]).catch(() => toast('Не удалось сохранить'))}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: enabled ? colors.ink : '#aaa' }}>{a}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{b}</Text>
          </CheckRow>
        ))}
      </Card>
      <Btn kind="ghost" label="Открыть настройки iOS" onPress={() => Linking.openSettings().catch(() => toast('Откройте настройки телефона вручную'))} />
    </Screen>
  );
}
