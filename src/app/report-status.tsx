import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Line, Loading, Screen, StateBlock, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/lang';
import { localeOf } from '@/i18n/current';

type ReportRow = { id: string; status: 'open' | 'actioned' | 'dismissed'; decision: string | null; created_at: string; decided_at: string | null };

// 87 · Результат жалобы
export default function ReportStatus() {
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, loading } = useAsync(async () => {
    let q = supabase.from('reports').select('id,status,decision,created_at,decided_at').order('created_at', { ascending: false }).limit(1);
    if (id) q = supabase.from('reports').select('id,status,decision,created_at,decided_at').eq('id', id).limit(1);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows?.[0] as ReportRow) ?? null;
  }, [id]);
  if (loading) return <Screen><BackLink /><Loading /></Screen>;
  if (!data) return <Screen><BackLink /><StateBlock icon="◎" title={t('screens.reportStatus.zhalobPokaNet')} copy={t('screens.reportStatus.zdesPoyavitsyaStatusKogda')} label={t('screens.reportStatus.tsentrBezopasnosti')} onPress={() => router.replace('/safety')} /></Screen>;
  const short = `#R-${data.id.slice(0, 4).toUpperCase()}`;
  const when = (iso: string) => new Date(iso).toLocaleString(localeOf(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const chip = data.status === 'open' ? <Chip label={t('screens.reportStatus.naRassmotrenii')} tone="amber" /> : data.status === 'actioned' ? <Chip label={t('screens.reportStatus.meryPrinyaty')} tone="green" /> : <Chip label={t('screens.reportStatus.narusheniyNeNaydeno')} />;
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/safety')} />
      <Title kicker={t('screens.reportStatus.zhalobaShort', { short })} heading={t('screens.reportStatus.zhalobaPoluchena')} sub={t('screens.reportStatus.statusIReshenieDostupny')} />
      <Card>
        <View style={{ flexDirection: 'row' }}>{chip}</View>
        <Line />
        <Text style={{ fontSize: 12, marginBottom: 8 }}>{t('screens.reportStatus.poluchenaV', { when: when(data.created_at) })}</Text>
        <Text style={{ fontSize: 12, marginBottom: 8 }}>{data.status === 'open' ? t('screens.reportStatus.proveryaetsyaModeratorom') : t('screens.reportStatus.reshenieV', { when: when(data.decided_at ?? data.created_at) })}</Text>
        <Text style={{ fontSize: 12 }}>{data.status === 'open' ? t('screens.reportStatus.reshenieIUvedomleniePoyavy') : data.decision === 'warning' ? t('screens.reportStatus.polzovatelPoluchilPredupre') : data.decision === 'suspension' ? t('screens.reportStatus.akkauntVremennoOgranichen') : data.decision === 'ban' ? t('screens.reportStatus.akkauntZablokirovan') : t('screens.reportStatus.myProveriliZhalobu')}</Text>
      </Card>
      <Btn kind="tertiary" label={t('screens.reportStatus.svyazatsyaSPodderzhkoy')} onPress={() => router.push('/support-help')} />
      <Btn kind="ghost" label={t('screens.reportStatus.osporitReshenie')} onPress={() => router.push({ pathname: '/appeal', params: { id: data.id } })} />
    </Screen>
  );
}
