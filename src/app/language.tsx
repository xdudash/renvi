import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, Choice, Screen, Title } from '@/components/ui';
import { LANGUAGE_FLAGS, LANGUAGE_NAMES, useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { api, type Lang } from '@/lib/api';

// 02 · Выбрать язык
export default function Language() {
  const { lang, setLang } = useLang();
  const { session } = useSession();
  const pick = (l: Lang) => {
    setLang(l);
    if (session) api.saveOnboarding({ language: l }).catch(() => {});
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker="ВАШ ЯЗЫК" heading={'Начнём на\nвашем языке'} sub="Язык можно изменить в профиле в любой момент." />
      <View style={{ marginTop: 20 }}>
        {(Object.keys(LANGUAGE_NAMES) as Lang[]).map((k) => (
          <Choice key={k} selected={lang === k} onPress={() => pick(k)}>
            <Text style={{ fontSize: 12 }}><Text style={{ fontSize: 17 }}>{LANGUAGE_FLAGS[k]}</Text>{'　'}{LANGUAGE_NAMES[k]}</Text>
            <Text>{lang === k ? '✓' : '○'}</Text>
          </Choice>
        ))}
      </View>
      <Btn label="Продолжить" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
