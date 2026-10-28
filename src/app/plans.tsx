import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Between, Btn, Chip, Line, LinkBtn, Screen, Segmented, Tiny, Title } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { useAsync } from '@/hooks/useAsync';
import { loadOffers } from '@/lib/purchases';
import { setPlanChoice } from '@/lib/planChoice';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

// 79 · Подписка
export default function Plans() {
  const { tier } = useSession();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [selected, setSelected] = useDraft<'free' | 'plus' | 'premium'>(tier);
  const offers = useAsync(() => loadOffers().catch(() => []), []);
  const limitsAll = useAsync(() => api.config<Record<string, any>>('tier_limits'), []);
  const L = limitsAll.data ?? {};
  const price = (t: 'plus' | 'premium') => offers.data?.find((o) => o.tier === t && o.period === period)?.price ?? 'Цена App Store';
  const card = (t: 'free' | 'plus' | 'premium', title: string, lines: [string, string]) => {
    const active = selected === t;
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSelected(t)}
        style={{ borderWidth: active ? 1.5 : 1, borderColor: active ? colors.red : colors.line, borderRadius: 18, padding: 14, marginVertical: 8, backgroundColor: colors.white }}>
        <Between><Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.9 }}>{title}</Text>{tier === t ? <Chip label="ТЕКУЩИЙ" tone="red" /> : active ? <Chip label="ВЫБРАНО" tone="red" /> : null}</Between>
        {t !== 'free' ? <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>{price(t)} <Text style={{ fontSize: 10, color: colors.muted }}>/ {period === 'month' ? 'месяц' : 'год'}</Text></Text> : <Tiny>{lines[0]}</Tiny>}
        <Line />
        <Tiny>{t === 'free' ? lines[1] : lines[0]}</Tiny>
      </Pressable>
    );
  };
  const go = () => {
    if (selected === 'free') { router.back(); return; }
    setPlanChoice({ tier: selected, period });
    router.push({ pathname: '/purchase-state', params: { action: 'buy' } });
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="RENVI PLUS / PREMIUM" heading={'Больше возможностей.\nВаш выбор.'} sub="Выберите подходящий уровень. Функции, период и цена будут подтверждены системным экраном App Store." />
      <Segmented items={[{ key: 'month', label: 'Месяц' }, { key: 'year', label: 'Год' }]} value={period} onChange={(k) => setPeriod(k as 'month' | 'year')} />
      {card('free', 'Free', [`${L.free?.daily_likes ?? 20} лайков в день · базовые фильтры`, 'Входящие искры скрыты · откат пропуска недоступен · без инкогнито'])}
      {card('plus', 'RENVI Plus', [`${L.plus?.daily_likes ?? 100} лайков в день · смотреть входящие · расширенные фильтры · отменить пропуск`, ''])}
      {card('premium', 'RENVI Premium', [`${L.premium?.daily_likes ?? 300} лайков в день · входящие · расширенные фильтры · отменить пропуск · инкогнито`, ''])}
      <Tiny>Лимиты Free/Plus/Premium хранятся в серверной конфигурации. Подписка автоматически продлевается до отмены. Срок, локальная цена, валюта и налоги показываются до подтверждения в App Store. Управление и отмена — в настройках Apple ID.</Tiny>
      <Btn label="Продолжить в App Store" disabled={selected === tier} onPress={go} />
      <Btn kind="ghost" label="Восстановить покупки" onPress={() => router.push({ pathname: '/purchase-state', params: { action: 'restore' } })} />
      <View><LinkBtn label="Условия · политика возврата" onPress={() => router.push('/legal')} /></View>
    </Screen>
  );
}
