import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Screen } from '@/components/ui';
import { GreenCard } from '@/components/Kit';
import { categoryOf } from '@/lib/plans';
import { useLang } from '@/lib/lang';

// connected · a mutual «привет» (company) or «позвать вчетвером» (couples): the chat is open.
export default function Connected() {
  const { t } = useLang();
  const { match, name, look, kind } = useLocalSearchParams<{ match?: string; name?: string; look?: string; kind?: string }>();
  const couples = kind === 'couples';
  const common = (look ?? '').split(',').filter(Boolean).map((k) => t(categoryOf(k).label).toLowerCase()).join(', ');
  return (
    <Screen>
      <GreenCard style={{ marginTop: 30 }}>
        <View style={s.faces}>
          <View style={s.av}><Text style={s.avText}>★</Text></View>
          <View style={s.av}><Text style={s.avText}>{(name ?? '?').slice(0, 1).toUpperCase()}</Text></View>
        </View>
        <Text style={s.kicker}>{(couples ? t('connected.coupleKicker') : t('connected.kicker')).toUpperCase()}</Text>
        <Text style={s.h}>{t('connected.h')}</Text>
        <Text style={s.p}>{couples ? t('connected.coupleCopy', { name: name ?? '' }) : t('connected.copy', { name: name ?? '' })}{common ? ` ${t('connected.common', { look: common })}` : ''}</Text>
        {!couples ? (
          <View style={s.box}>
            <Text style={s.boxEyebrow}>{t('connected.start')}</Text>
            <Text style={s.boxText}>{t('connected.starter')}</Text>
          </View>
        ) : null}
      </GreenCard>
      <Btn label={t('connected.write')} onPress={() => router.replace({ pathname: '/chat', params: { match } })} />
      {!couples ? <Btn kind="secondary" label={t('connected.plan')} onPress={() => router.push('/plan-create')} /> : null}
      <Btn kind="ghost" label={t('connected.more')} onPress={() => router.replace(couples ? '/couples' : '/company')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  kicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, color: '#BFE0CB', marginTop: 16 },
  faces: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  av: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  h: { fontSize: 30, fontWeight: '900', letterSpacing: -1.2, color: '#fff', marginVertical: 6 },
  p: { fontSize: 12.5, lineHeight: 19, color: '#DCEFE3', textAlign: 'center' },
  box: { backgroundColor: '#ffffff1f', borderRadius: 16, padding: 12, marginTop: 12, alignSelf: 'stretch' },
  boxEyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: '#BFE0CB' },
  boxText: { fontSize: 12.5, color: '#fff', marginTop: 5 },
});
