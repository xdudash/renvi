import { Text, View } from 'react-native';
import { Card, Chip } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { localeOf } from '@/i18n/current';

type Row = { status: 'open' | 'accepted' | 'rejected'; decision_reason: string | null; decided_at: string | null; created_at: string };

// The user's latest appeal (optionally for one report) with the moderator's decision and reason.
export function AppealOutcome({ reportId }: { reportId?: string }) {
  const { t } = useLang();
  const { data } = useAsync(async () => {
    let q = supabase.from('appeals').select('status, decision_reason, decided_at, created_at').order('created_at', { ascending: false }).limit(1);
    if (reportId) q = q.eq('report_id', reportId);
    const { data: rows } = await q;
    return ((rows ?? [])[0] as Row | undefined) ?? null;
  }, [reportId]);
  if (!data) return null;
  const when = (iso: string) => new Date(iso).toLocaleString(localeOf(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return (
    <Card tight>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {data.status === 'open' ? <Chip label={t('adm.appealOutcome.open')} tone="amber" />
          : data.status === 'accepted' ? <Chip label={t('adm.appealOutcome.accepted')} tone="green" />
            : <Chip label={t('adm.appealOutcome.rejected')} tone="red" />}
      </View>
      <Text style={{ fontSize: 12 }}>
        {data.status === 'open' ? t('adm.appealOutcome.openCopy', { when: when(data.created_at) }) : t('adm.appealOutcome.decided', { when: when(data.decided_at ?? data.created_at) })}
      </Text>
      {data.decision_reason ? <Text style={{ fontSize: 12, marginTop: 6 }}>{t('adm.appealOutcome.reason', { reason: data.decision_reason })}</Text> : null}
    </Card>
  );
}
