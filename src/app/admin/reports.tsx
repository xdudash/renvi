import { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminPage, Act, Tbl } from '@/components/AdminUI';
import { Loading, Pill, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { daysFromNowIso } from '@/lib/time';

type R = { id: string; reason: string; details: string | null; message_snapshot: string | null; target_profile_id: string | null; status: string; created_at: string };

export default function AdminReports() {
  const toast = useToast();
  const [status, setStatus] = useState<string>('open');
  const { data, loading, reload } = useAsync(async () => {
    const { data: d, error } = await supabase.rpc('admin_list_reports', { p_status: status });
    if (error) throw error;
    return d as R[];
  }, [status]);
  const decide = async (id: string, decision: 'actioned' | 'dismissed', sanction: string | null, days?: number) => {
    const until = days ? daysFromNowIso(days) : null;
    const { error } = await supabase.rpc('admin_decide_report', { p_report: id, p_decision: decision, p_sanction: sanction, p_until: until });
    toast(error ? 'Ошибка: ' + error.message : 'Решение сохранено');
    reload();
  };
  return (
    <AdminPage title="Жалобы">
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {[['open', 'Открытые'], ['actioned', 'Меры приняты'], ['dismissed', 'Отклонены']].map(([k, l]) => <Pill key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
      </View>
      {loading ? <Loading /> : (
        <Tbl head={['Когда', 'Причина', 'Детали', 'Сообщение', 'Профиль', 'Решение']} rows={(data ?? []).map((r) => [
          new Date(r.created_at).toLocaleString('ru-RU'), r.reason, r.details ?? '—', r.message_snapshot ?? '—', r.target_profile_id?.slice(0, 8) ?? '—',
          r.status === 'open' ? (
            <View key="act">
              <Act label="Предупреждение" onPress={() => decide(r.id, 'actioned', 'warning')} />
              <Act label="Пауза 7 дней" onPress={() => decide(r.id, 'actioned', 'suspension', 7)} />
              <Act label="Блокировка" tone="red" onPress={() => decide(r.id, 'actioned', 'ban')} />
              <Act label="Нарушений нет" tone="green" onPress={() => decide(r.id, 'dismissed', null)} />
            </View>
          ) : <Text style={{ fontSize: 12 }}>{r.status}</Text>,
        ])} />
      )}
    </AdminPage>
  );
}
