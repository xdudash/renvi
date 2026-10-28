import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Card, Eyebrow, Field, LinkBtn, Loading, Pill, Screen, Tiny, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { setDraft } from '@/lib/drafts';

// 42 · Сценарии начала разговора
export default function Icebreakers() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const [own, setOwn] = useState('');
  const use = (text: string) => { setDraft(match, text); router.back(); };
  if (ctx.loading) return <Screen tabs="chats"><BackLink /><Loading /></Screen>;
  const p = ctx.data?.their_prompts[0];
  const interest = ctx.data?.their_interests[0];
  const topic = p ? `«${p.question} ${p.answer}» — расскажешь подробнее?` : interest ? `Ты упомянул(а) ${interest.toLowerCase()} — с чего у тебя это началось?` : null;
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ПЕРВЫЙ ШАГ" heading="Выберите свой способ начать" sub="Подсказки помогают, но текст остаётся вашим. Никаких автоматических сообщений." />
      {topic ? (
        <Card>
          <Eyebrow>1 · ОТКЛИКНУТЬСЯ НА АНКЕТУ</Eyebrow>
          <Text style={{ fontSize: 13, lineHeight: 19 }}>{topic}</Text>
          <LinkBtn label="Использовать тему　›" onPress={() => use(topic)} />
        </Card>
      ) : null}
      <Card>
        <Eyebrow>{topic ? '2' : '1'} · ЛЁГКИЙ ВОПРОС</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Pill label="Кофе или прогулка?" onPress={() => use('Кофе или прогулка у воды?')} />
          <Pill label="Город, куда вернуться?" onPress={() => use('Какой город хочется увидеть снова?')} />
        </View>
      </Card>
      <Card>
        <Eyebrow>{topic ? '3' : '2'} · СВОЯ ТЕМА</Eyebrow>
        <Field value={own} onChangeText={setOwn} multiline style={{ minHeight: 83, textAlignVertical: 'top' }} placeholder="Напишите так, как сказали бы сами" />
        {own.trim() ? <LinkBtn label="Перенести в сообщение　›" onPress={() => use(own.trim())} /> : null}
        <LinkBtn label="Настроить свои темы для новых совпадений" onPress={() => router.push('/opening-moves')} />
      </Card>
      <Tiny>Подсказки можно отключить в любое время.</Tiny>
    </Screen>
  );
}
