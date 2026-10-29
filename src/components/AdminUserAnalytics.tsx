import { Text } from 'react-native';
import { Section, Tbl, Busy, ErrorNote, errText } from './AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { analyticsApi } from '@/lib/analyticsApi';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';
export const eventLabels:Record<string,TranslationKey>={screen_view:'analytics.screenView',heartbeat:'analytics.heartbeat',onboard:'analytics.onboard',like:'analytics.like',match:'analytics.match',date:'analytics.date'};
export function AdminUserAnalytics({userId}:{userId:string}) {
 const {t}=useLang();
 const {data,loading,error,reload}=useAsync(()=>analyticsApi.user(userId),[userId]);
 return <Section title={t('analytics.timeline')}>
  <Text style={{color:colors.sub,marginBottom:10}}>{t('analytics.timelineNote')}</Text>
  {loading?<Busy/>:null}{error?<ErrorNote message={errText(error)} onRetry={reload}/>:null}
  {data?.excluded?<Text>{t('analytics.demoExcluded')}</Text>:data?<>
   <Text style={{color:colors.ink,marginBottom:10}}>{t(data.consented?'analytics.consentOn':'analytics.consentOff')} · {t('analytics.sessions')}: {data.sessions??0} · {t('analytics.time')}: {data.active_seconds??0}</Text>
   <Tbl head={[t('analytics.at'),t('analytics.event'),t('analytics.screen'),t('analytics.seconds')]} widths={[190,230,140,100]} empty={t('adm.common.empty')}
    rows={data.timeline.map(e=>[new Date(e.created_at).toLocaleString(),eventLabels[e.event]?t(eventLabels[e.event]):e.event,e.screen??'—',e.active_seconds])}/>
  </>:null}
 </Section>;
}
