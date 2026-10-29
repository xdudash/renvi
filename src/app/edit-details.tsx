import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Eyebrow, Field, Pill, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { DETAIL_ICON, DETAIL_OPTIONS, DETAIL_ORDER, LANGUAGES, MAX_LANGUAGES, detailTitle, detailValue, languageLabel, type DetailKey } from '@/lib/details';

// Подробнее обо мне: optional details shown on the card (height, languages, kids, habits, education, pets, zodiac).
export default function EditDetails() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const [height, setHeight] = useDraft<string>(profile?.height_cm ? String(profile.height_cm) : '');
  const [langs, setLangs] = useDraft<string[]>(Array.isArray(profile?.languages) ? profile.languages : []);
  const [vals, setVals] = useDraft<Partial<Record<DetailKey, string | null>>>(
    Object.fromEntries(DETAIL_ORDER.map((k) => [k, profile?.[k] ?? null])));
  const [busy, setBusy] = useState(false);

  const toggleLang = (c: string) => {
    if (langs.includes(c)) { setLangs(langs.filter((x) => x !== c)); return; }
    if (langs.length >= MAX_LANGUAGES) { toast(t('details.languagesMax')); return; }
    setLangs([...langs, c]);
  };
  const save = async () => {
    const h = height.trim() ? Number(height.trim()) : null;
    if (h !== null && !(Number.isInteger(h) && h >= 120 && h <= 230)) { toast(t('details.heightHint')); return; }
    setBusy(true);
    try {
      await api.saveDetails({ height_cm: h, languages: langs, ...vals });
      await refresh();
      toast(t('details.saved'));
      router.navigate('/edit-profile');
    } catch { toast(t('details.saveFailed')); } finally { setBusy(false); }
  };

  return (
    <Screen tabs="me">
      <BackLink onPress={() => router.navigate('/edit-profile')} />
      <Title kicker={t('details.editKicker')} heading={t('details.editHeading')} sub={t('details.editSub')} />
      <Eyebrow>{DETAIL_ICON.height_cm} {detailTitle(t, 'height_cm')}</Eyebrow>
      <Field value={height} onChangeText={(v) => setHeight(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="175" accessibilityLabel={t('details.heightA11y')} />
      <Tiny>{t('details.heightHint')}</Tiny>
      <Eyebrow style={{ marginTop: 16 }}>{DETAIL_ICON.languages} {detailTitle(t, 'languages')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {LANGUAGES.map((c) => <Pill key={c} label={languageLabel(t, c)} active={langs.includes(c)} onPress={() => toggleLang(c)} />)}
      </View>
      {DETAIL_ORDER.map((k) => (
        <View key={k} style={{ marginTop: 12 }}>
          <Eyebrow>{DETAIL_ICON[k]} {detailTitle(t, k)}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {DETAIL_OPTIONS[k].map((v) => (
              <Pill key={v} label={detailValue(t, k, v)} active={vals[k] === v} onPress={() => setVals({ ...vals, [k]: vals[k] === v ? null : v })} />
            ))}
          </View>
        </View>
      ))}
      <View style={{ height: 12 }} />
      <Btn label={t('details.save')} busy={busy} onPress={save} />
    </Screen>
  );
}
