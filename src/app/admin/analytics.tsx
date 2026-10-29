import { Text, View } from 'react-native';
import { AdminPage, Act, Section, Tbl, Busy, ErrorNote, errText, Banner } from '@/components/AdminUI';
import { eventLabels } from '@/components/AdminUserAnalytics';
import { useAsync } from '@/hooks/useAsync';
import { analyticsApi, type Retention } from '@/lib/analyticsApi';
import { useLang } from '@/lib/lang';
import { useState } from 'react';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';
const stages: [string,TranslationKey][]=[['first_visit','analytics.firstVisit'],['signup','analytics.signup'],['measured_session','analytics.measuredSession'],['onboard','analytics.onboard'],['like','analytics.like'],['match','analytics.match'],['date','analytics.date']];
export default function AnalyticsPage(){
 const {t}=useLang();const [days,setDays]=useState(30);
 const {data,loading,error,reload}=useAsync(()=>analyticsApi.report(days),[days]);
 const retentionRow=(r:Retention)=>[r.d,r.eligible,r.returned,r.eligible?`${(100*r.returned/r.eligible).toFixed(1)}%`:'—'];
 const retentionHead=[t('analytics.day'),t('analytics.eligible'),t('analytics.returned'),t('analytics.rate')];
 const tile=(key:keyof NonNullable<typeof data>,label:TranslationKey)=><View key={key} style={{minWidth:130,flexBasis:150,flexGrow:1,padding:12,borderTopWidth:2,borderColor:colors.ink}}><Text style={{fontSize:30,fontWeight:'800',color:colors.ink}}>{String(data?.[key]??0)}</Text><Text style={{color:colors.sub}}>{t(label)}</Text></View>;
 return <AdminPage title={t('analytics.title')} sub={t('analytics.period',{days})} right={<Act label={t('adm.common.refresh')} onPress={reload}/>}>
  <View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:16}}>{[7,30,90,180].map(d=><Act key={d} label={t('analytics.period',{days:d})} tone={days===d?'ink':'ghost'} onPress={()=>setDays(d)}/>)}</View>
  <Banner><Text>{t('analytics.note')}</Text><Text style={{marginTop:6}}>{t('analytics.population')}</Text></Banner>
  {error?<ErrorNote message={errText(error)} onRetry={reload}/>:null}{loading&&!data?<Busy/>:null}
  {data?<>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:20}}>{tile('total','analytics.total')}{tile('new','analytics.new')}{tile('consented','analytics.consented')}{tile('measured','analytics.measured')}{tile('dau','analytics.dau')}{tile('wau','analytics.wau')}{tile('mau','analytics.mau')}{tile('online','analytics.online')}{tile('sessions','analytics.sessions')}{tile('active_seconds','analytics.time')}</View>
   <Text style={{color:colors.sub,marginBottom:12}}>{t('analytics.meanTime')}: {data.sessions?Math.round(data.active_seconds/data.sessions):'—'}</Text>
   <Section title={t('analytics.demographics')}><Tbl head={[t('analytics.country'),t('analytics.gender'),t('analytics.age'),t('analytics.users')]} widths={[100,120,100,100]} rows={data.demographics.map(r=>[r.country,r.gender,r.age_group,r.users])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.acquisition')}><Tbl head={[t('analytics.source'),t('analytics.medium'),t('analytics.campaign'),t('analytics.referral'),t('analytics.users')]} widths={[130,130,160,140,100]} rows={data.acquisition.map(r=>[r.source,r.medium??'—',r.campaign??'—',r.referral??'—',r.users])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.funnel')}><Text style={{color:colors.sub,marginBottom:10}}>{t('analytics.funnelNote')}</Text><Tbl head={[t('analytics.stage'),t('analytics.users')]} widths={[280,160]} rows={stages.map(([key,label])=>[t(label),data.funnel[key]??t('analytics.unavailable')])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.screens')}><Tbl head={[t('analytics.screen'),t('analytics.views'),t('analytics.seconds')]} widths={[220,120,120]} rows={data.screens.map(r=>[r.screen,r.views,r.active_seconds])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.hourly')}><Tbl head={[t('analytics.hour'),t('analytics.count'),t('analytics.seconds')]} widths={[140,120,120]} rows={data.hourly.map(r=>[r.hour,r.events,r.active_seconds])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.weekdays')}><Tbl head={[t('analytics.weekday'),t('analytics.count'),t('analytics.seconds')]} widths={[220,120,120]} rows={data.weekdays.map(r=>[r.weekday,r.events,r.active_seconds])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.actions')}><Tbl head={[t('analytics.event'),t('analytics.count')]} widths={[280,120]} rows={data.actions.map(r=>[eventLabels[r.event]?t(eventLabels[r.event]):r.event,r.events])} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.retention')}><Text style={{color:colors.sub,marginBottom:10}}>{t('analytics.retentionNote')}</Text><Tbl head={retentionHead} widths={[100,110,110,100]} rows={data.retention.map(retentionRow)} empty={t('adm.common.empty')}/></Section>
   <Section title={t('analytics.cohorts')}><Tbl head={[t('analytics.week'),...retentionHead]} widths={[150,100,110,110,100]} rows={data.cohorts.map(r=>[r.week??'—',...retentionRow(r)])} empty={t('adm.common.empty')}/></Section>
  </>:null}
 </AdminPage>;
}
