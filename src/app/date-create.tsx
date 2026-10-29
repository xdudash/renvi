import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Choice, Eyebrow, LinkBtn, Row, SafeBanner, Screen, Title } from '@/components/ui';
import { getDateDraft, resetDateDraft, setDateDraft, dayLong, weekDays, iso } from '@/lib/dateDraft';
import { placeLabel } from '@/lib/catalog';
import { isPastDay } from '@/lib/dateSlots';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 55 · Создать приглашение
export default function DateCreate() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const [d] = useState(() => {
    if (getDateDraft().match !== match) resetDateDraft(match);
    if (isPastDay(getDateDraft().day, new Date())) { const days = weekDays('this'); setDateDraft({ day: iso(days[days.length - 1]) }); }
    return getDateDraft();
  });
  const pick = (place: string) => { setDateDraft({ place }); router.push({ pathname: '/date-place', params: { match } }); };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.dateCreate.ideyaDlyaVstrechi')} heading={t('screens.dateCreate.davayteUvidimsya')} sub={t('screens.dateCreate.snachalaVyberitePublichnoe')} />
      <Card>
        <Eyebrow>{t('screens.dateCreate.populyarnoRyadom')}</Eyebrow>
        <Choice selected={d.place === 'eurovea'} onPress={() => pick('eurovea')}><Text style={{ fontSize: 12 }}>{t('screens.dateCreate.euroveaNaberezhnaya')}</Text><Text>›</Text></Choice>
        <Choice selected={d.place === 'oldtown'} onPress={() => pick('oldtown')}><Text style={{ fontSize: 12 }}>{t('screens.dateCreate.staryyGorod')}</Text><Text>›</Text></Choice>
        <Choice selected={d.place === 'custom'} onPress={() => pick('custom')}><Text style={{ fontSize: 12 }}>{t('screens.dateCreate.predlozhitDrugoePublichnoe')}</Text><Text>›</Text></Choice>
      </Card>
      <Card tight>
        <Row>
          <Text style={{ color: colors.red, fontSize: 22 }}>⌑</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{d.day ? dayLong(d.day) : ''} · {d.time}</Text>
            <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.dateCreate.vVremyaMozhnoIzmenit', { place: placeLabel(d.place, d.custom, t) })}</Text>
          </View>
          <LinkBtn label={t('screens.dateCreate.izmenit')} onPress={() => router.push({ pathname: '/date-time', params: { match } })} />
        </Row>
      </Card>
      <Btn label={t('screens.dateCreate.prodolzhit')} onPress={() => router.push({ pathname: '/date-time', params: { match } })} />
      <SafeBanner>{t('screens.dateCreate.vstrettesVLyudnomMeste')}</SafeBanner>
    </Screen>
  );
}
