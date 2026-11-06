import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, Screen, Tag, Title } from '@/components/ui';
import { LANGUAGE_NAMES, useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { api, type Lang } from '@/lib/api';

// 02 · Выбрать язык
export default function Language() {
  const { lang, setLang, t } = useLang();
  const { session } = useSession();
  const pick = (l: Lang) => {
    setLang(l);
    if (session) api.saveOnboarding({ language: l }).catch(() => {});
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.language.kicker')} heading={t('screens.language.heading')} sub={t('screens.language.sub')} />
      <View style={{ marginTop: 18 }}>
        {(Object.keys(LANGUAGE_NAMES) as Lang[]).map((k) => (
          <Choice key={k} selected={lang === k} onPress={() => pick(k)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Tag label={k} width={30} />
              <Text style={{ fontSize: 13, fontWeight: '700' }}>{LANGUAGE_NAMES[k]}</Text>
            </View>
            <Text>{lang === k ? '✓' : '○'}</Text>
          </Choice>
        ))}
      </View>
      <Btn label={t('screens.language.continue')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
