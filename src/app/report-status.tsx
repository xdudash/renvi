import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Line, Loading, Screen, StateBlock, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';

type ReportRow = { id: string; status: 'open' | 'actioned' | 'dismissed'; decision: string | null; created_at: string; decided_at: string | null };

// 87 · Результат жалобы
export default function ReportStatus() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, loading } = useAsync(async () => {
    let q = supabase.from('reports').select('id,status,decision,created_at,decided_at').order('created_at', { ascending: false }).limit(1);
    if (id) q = supabase.from('reports').select('id,status,decision,created_at,decided_at').eq('id', id).limit(1);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows?.[0] as ReportRow) ?? null;
  }, [id]);
  if (loading) return <Screen><BackLink /><Loading /></Screen>;
  if (!data) return <Screen><BackLink /><StateBlock icon="◎" title="Жалоб пока нет" copy="Здесь появится статус, когда вы отправите жалобу." label="Центр безопасности" onPress={() => router.replace('/safety')} /></Screen>;
  const short = `#R-${data.id.slice(0, 4).toUpperCase()}`;
  const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const chip = data.status === 'open' ? <Chip label="НА РАССМОТРЕНИИ" tone="amber" /> : data.status === 'actioned' ? <Chip label="МЕРЫ ПРИНЯТЫ" tone="green" /> : <Chip label="НАРУШЕНИЙ НЕ НАЙДЕНО" />;
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/safety')} />
      <Title kicker={`ЖАЛОБА · ${short}`} heading="Жалоба получена" sub="Статус и решение доступны только вам." />
      <Card>
        <View style={{ flexDirection: 'row' }}>{chip}</View>
        <Line />
        <Text style={{ fontSize: 12, marginBottom: 8 }}>Получена · {when(data.created_at)}</Text>
        <Text style={{ fontSize: 12, marginBottom: 8 }}>{data.status === 'open' ? 'Проверяется модератором' : `Решение · ${when(data.decided_at ?? data.created_at)}`}</Text>
        <Text style={{ fontSize: 12 }}>{data.status === 'open' ? 'Решение и уведомление появятся здесь' : data.decision === 'warning' ? 'Пользователь получил предупреждение' : data.decision === 'suspension' ? 'Аккаунт временно ограничен' : data.decision === 'ban' ? 'Аккаунт заблокирован' : 'Мы проверили жалобу'}</Text>
      </Card>
      <Btn kind="tertiary" label="Связаться с поддержкой" onPress={() => router.push('/support-help')} />
      <Btn kind="ghost" label="Оспорить решение" onPress={() => router.push({ pathname: '/appeal', params: { id: data.id } })} />
    </Screen>
  );
}
