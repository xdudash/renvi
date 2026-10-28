import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Choice, Eyebrow, LinkBtn, Row, SafeBanner, Screen, Title } from '@/components/ui';
import { getDateDraft, resetDateDraft, setDateDraft, dayLong, weekDays, iso } from '@/lib/dateDraft';
import { placeLabel } from '@/lib/catalog';
import { colors } from '@/theme/tokens';

// 55 · Создать приглашение
export default function DateCreate() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const [d] = useState(() => {
    if (getDateDraft().match !== match) resetDateDraft(match);
    if (!getDateDraft().day) { const days = weekDays('this'); setDateDraft({ day: iso(days[days.length - 1]) }); }
    return getDateDraft();
  });
  const pick = (place: string) => { setDateDraft({ place }); router.push({ pathname: '/date-place', params: { match } }); };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ИДЕЯ ДЛЯ ВСТРЕЧИ" heading="Давайте увидимся" sub="Сначала выберите публичное место. Домашние адреса не показываются." />
      <Card>
        <Eyebrow>ПОПУЛЯРНО РЯДОМ</Eyebrow>
        <Choice selected={d.place === 'eurovea'} onPress={() => pick('eurovea')}><Text style={{ fontSize: 12 }}>☕ Eurovea · набережная</Text><Text>›</Text></Choice>
        <Choice selected={d.place === 'oldtown'} onPress={() => pick('oldtown')}><Text style={{ fontSize: 12 }}>📍 Старый город</Text><Text>›</Text></Choice>
        <Choice selected={d.place === 'custom'} onPress={() => pick('custom')}><Text style={{ fontSize: 12 }}>＋ Предложить другое публичное место</Text><Text>›</Text></Choice>
      </Card>
      <Card tight>
        <Row>
          <Text style={{ color: colors.red, fontSize: 22 }}>⌑</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{d.day ? dayLong(d.day) : ''} · {d.time}</Text>
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{placeLabel(d.place, d.custom)} · время можно изменить</Text>
          </View>
          <LinkBtn label="Изменить" onPress={() => router.push({ pathname: '/date-time', params: { match } })} />
        </Row>
      </Card>
      <Btn label="Продолжить" onPress={() => router.push({ pathname: '/date-time', params: { match } })} />
      <SafeBanner>Встретьтесь в людном месте и самостоятельно спланируйте дорогу домой.</SafeBanner>
    </Screen>
  );
}
