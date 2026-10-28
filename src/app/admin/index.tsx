import { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminPage } from '@/components/AdminUI';
import { Pill, Loading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

const LABELS: Record<string, string> = {
  profiles: 'Опубликованные анкеты', sparks: 'Искры', matches: 'Совпадения', messages: 'Сообщения', dates: 'Приглашения на встречу',
  open_reports: 'Открытые жалобы', paid_subscribers: 'Платящие подписчики', pending_verification: 'Селфи на проверке',
};

export default function AdminHome() {
  const [country, setCountry] = useState<string | null>(null);
  const { data, loading } = useAsync(async () => {
    const { data: d, error } = await supabase.rpc('admin_stats', { p_country: country });
    if (error) throw error;
    return d as Record<string, number>;
  }, [country]);
  return (
    <AdminPage title="Дашборд">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {[null, 'SK', 'CZ'].map((c) => <Pill key={c ?? 'all'} label={c ?? 'Все страны'} active={country === c} onPress={() => setCountry(c)} />)}
      </View>
      {loading ? <Loading /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(LABELS).map(([k, l]) => (
            <View key={k} style={{ width: 160, borderTopWidth: 2, borderTopColor: colors.ink, paddingVertical: 12 }}>
              <Text style={{ fontSize: 40, fontWeight: '900', letterSpacing: -2, color: colors.red }}>{data?.[k] ?? 0}</Text>
              <Text style={{ fontSize: 12, color: colors.ink }}>{l}</Text>
            </View>
          ))}
        </View>
      )}
    </AdminPage>
  );
}
