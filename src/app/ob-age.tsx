import { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, CheckRow, Field, SafeBanner, Screen, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { useSession } from '@/lib/session';

const isoOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// 10 · Возраст и имя
export default function ObAge() {
  const { profile } = useSession();
  const toast = useToast();
  const [name, setName] = useDraft<string>(profile?.display_name ?? '');
  const [birthdate, setBirthdate] = useState('');
  const [adult, setAdult] = useDraft(Boolean(profile?.adult_confirmed_at));
  const [terms, setTerms] = useDraft(Boolean(profile?.terms_accepted_at));
  const { save, busy, saveDraftAndExit } = useStepSave('ob-age');
  const next = () => {
    if (!adult || !terms) { toast('Подтвердите возраст и условия, чтобы продолжить'); return; }
    if (name.trim().length < 1) { toast('Введите имя'); return; }
    if (!isoOk(birthdate)) { toast('Укажите дату рождения в формате ГГГГ-ММ-ДД'); return; }
    save({ display_name: name.trim(), birthdate, adult_confirmed: true, terms_accepted: true });
  };
  return (
    <Screen>
      <OnbHeader step={0} kicker="ПЕРВЫЙ ШАГ" heading="Сколько вам лет?" sub="Участникам RENVI должно быть 18 лет или больше." />
      <Field label="ИМЯ" value={name} onChangeText={setName} placeholder="Как вас называть" autoComplete="given-name" />
      <Field label="ДАТА РОЖДЕНИЯ" value={birthdate} onChangeText={setBirthdate} placeholder="1998-08-12" keyboardType="numbers-and-punctuation" maxLength={10} />
      <CheckRow left on={adult} onPress={() => setAdult(!adult)}><Text style={{ fontSize: 12 }}>Мне уже исполнилось 18 лет</Text></CheckRow>
      <CheckRow left on={terms} onPress={() => setTerms(!terms)}><Text style={{ fontSize: 12 }}>Я принимаю Условия и Правила сообщества</Text></CheckRow>
      <SafeBanner>Дата рождения не будет отображаться в профиле. Другие пользователи увидят только возраст.</SafeBanner>
      <Btn label="Продолжить" onPress={next} busy={busy} />
      <View><Btn kind="ghost" label="Сохранить черновик и выйти" onPress={() => saveDraftAndExit(name.trim() ? { display_name: name.trim() } : {})} /></View>
    </Screen>
  );
}
