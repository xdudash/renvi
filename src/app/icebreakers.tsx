import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Card, Eyebrow, Field, LinkBtn, Loading, Pill, Screen, Tiny, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { setDraft } from '@/lib/drafts';
import { interestLabel, promptLabel } from '@/lib/catalog';
import { useLang } from '@/lib/lang';

// 42 · Сценарии начала разговора
export default function Icebreakers() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const [own, setOwn] = useState('');
  const use = (text: string) => { setDraft(match, text); router.back(); };
  if (ctx.loading) return <Screen tabs="chats"><BackLink /><Loading /></Screen>;
  const p = ctx.data?.their_prompts[0];
  const interest = ctx.data?.their_interests[0];
  const topic = p ? t('screens.icebreakers.questionAnswerRasskazheshP', { question: promptLabel(t, p.question), answer: p.answer }) : interest ? t('screens.icebreakers.tyUpomyanulAV', { interest: interestLabel(t, interest).toLowerCase() }) : null;
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.icebreakers.pervyyShag')} heading={t('screens.icebreakers.vyberiteSvoySposobNachat')} sub={t('screens.icebreakers.podskazkiPomogayutNoTekst')} />
      {topic ? (
        <Card>
          <Eyebrow>{t('screens.icebreakers.n1OtkliknutsyaNaAnketu')}</Eyebrow>
          <Text style={{ fontSize: 13, lineHeight: 19 }}>{topic}</Text>
          <LinkBtn label={t('screens.icebreakers.ispolzovatTemu')} onPress={() => use(topic)} />
        </Card>
      ) : null}
      <Card>
        <Eyebrow>{t('screens.icebreakers.vLegkiyVopros', { n: topic ? '2' : '1' })}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Pill label={t('screens.icebreakers.kofeIliProgulka')} onPress={() => use(t('screens.icebreakers.kofeIliProgulkaU'))} />
          <Pill label={t('screens.icebreakers.gorodKudaVernutsya')} onPress={() => use(t('screens.icebreakers.kakoyGorodHochetsyaUvidet'))} />
        </View>
      </Card>
      <Card>
        <Eyebrow>{t('screens.icebreakers.vSvoyaTema', { n: topic ? '3' : '2' })}</Eyebrow>
        <Field value={own} onChangeText={setOwn} multiline style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder={t('screens.icebreakers.napishiteTakKakSkazali')} />
        {own.trim() ? <LinkBtn label={t('screens.icebreakers.perenestiVSoobschenie')} onPress={() => use(own.trim())} /> : null}
        <LinkBtn label={t('screens.icebreakers.nastroitSvoiTemyDlya')} onPress={() => router.push('/opening-moves')} />
      </Card>
      <Tiny>{t('screens.icebreakers.podskazkiMozhnoOtklyuchitV')}</Tiny>
    </Screen>
  );
}
