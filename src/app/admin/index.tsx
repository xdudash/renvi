import { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminPage } from '@/components/AdminUI';
import { Pill, Loading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';
import { useLang } from '@/lib/lang';

const LABELS: Record<string, TranslationKey> = {
  profiles: 'admin.index.profiles', sparks: 'admin.index.sparks', matches: 'admin.index.matches', messages: 'admin.index.messages', dates: 'admin.index.dates',
  open_reports: 'admin.index.openReports', paid_subscribers: 'admin.index.paid', pending_verification: 'admin.index.pendingVerification',
};

export default function AdminHome() {
  const { t } = useLang();
  const [country, setCountry] = useState<string | null>(null);
  const { data, loading } = useAsync(async () => {
    const { data: d, error } = await supabase.rpc('admin_stats', { p_country: country });
    if (error) throw error;
    return d as Record<string, number>;
  }, [country]);
  return (
    <AdminPage title={t('admin.index.title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {[null, 'SK', 'CZ'].map((c) => <Pill key={c ?? 'all'} label={c ?? t('admin.index.allCountries')} active={country === c} onPress={() => setCountry(c)} />)}
      </View>
      {loading ? <Loading /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(LABELS).map(([k, l]) => (
            <View key={k} style={{ width: 160, borderTopWidth: 2, borderTopColor: colors.ink, paddingVertical: 12 }}>
              <Text style={{ fontSize: 40, fontWeight: '900', letterSpacing: -2, color: colors.red }}>{data?.[k] ?? 0}</Text>
              <Text style={{ fontSize: 12, color: colors.ink }}>{t(l)}</Text>
            </View>
          ))}
        </View>
      )}
    </AdminPage>
  );
}
