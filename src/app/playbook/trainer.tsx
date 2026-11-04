import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { BackLink, Btn, Meter, Screen } from '@/components/ui';
import { FadeIn } from '@/components/Motion';
import { Chat, Label, Quiz, pb as pbs } from '@/components/Playbook';
import { playbookContent } from '@/playbook';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { TRAINER_COUNT, isUnlocked, setTrainerPos, usePlaybook } from '@/lib/playbook';
import { colors } from '@/theme/tokens';

// Lesson 8: 30 ready situations, three answers each, an explanation after the choice. Only the position is saved.
export default function PlaybookTrainer() {
  const { t, lang } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const list = playbookContent(lang).trainer;
  const [picked, setPicked] = useState<number | null>(null);
  if (pb.loaded && !isUnlocked(pb, 8)) return <Redirect href={'/playbook/paywall?to=8' as never} />;

  const pos = Math.min(pb.trainerPos, TRAINER_COUNT);
  const back = <BackLink label={`‹ ${t('playbook.heading')}`} onPress={() => router.navigate('/playbook')} />;

  if (pos >= list.length) {
    return (
      <Screen tabs="me">
        {back}
        <View style={[pbs.dark, { marginTop: 20, gap: 8 }]}>
          <Text style={s.doneTitle}>{t('playbook.trainerDone')}</Text>
          <Text style={s.doneSub}>{t('playbook.trainerDoneSub')}</Text>
        </View>
        <View style={{ height: 14 }} />
        <Btn label={t('playbook.restart')} onPress={() => { setPicked(null); setTrainerPos(0); }} />
        <View style={{ height: 8 }} />
        <Btn kind="ghost" label={t('playbook.toList')} onPress={() => router.navigate('/playbook')} />
      </Screen>
    );
  }

  const sit = list[pos];
  return (
    <Screen tabs="me" scroll={false}>
      {back}
      <View style={s.head}>
        <Label>{t('playbook.trainerTitle')}</Label>
        <Text style={s.counter}>{pos + 1} / {list.length}</Text>
      </View>
      <Meter value={Math.round(((pos + 1) / list.length) * 100)} />
      <ScrollView style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ paddingBottom: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
        <FadeIn key={pos} from={8}>
          <View style={s.card}>
            <Label tone="red">{sit.tag}</Label>
            {sit.context ? <Text style={s.context}>{sit.context}</Text> : null}
            <Chat msgs={sit.chat} status={sit.status} />
          </View>
          <Text style={s.ask}>{t('playbook.whatWrite')}</Text>
          <Quiz options={sit.options} best={sit.best} why={sit.why} picked={picked} onPick={setPicked} />
        </FadeIn>
      </ScrollView>
      <View style={{ paddingTop: 6 }}>
        <Btn label={t('playbook.nextSituation')} disabled={picked === null} onPress={() => { setPicked(null); setTrainerPos(pos + 1); }} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  counter: { fontSize: 13, fontWeight: '800', color: colors.ink },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, gap: 4 },
  context: { fontSize: 14, lineHeight: 20, color: '#4a4541', marginTop: 4 },
  ask: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 14, marginBottom: 8, letterSpacing: -0.4 },
  doneTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  doneSub: { color: '#CFC9C1', fontSize: 14, lineHeight: 20 },
});
