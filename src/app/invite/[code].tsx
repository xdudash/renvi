import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Bold, Btn, Card, Loading, Row, Screen, Title } from '@/components/ui';
import { Text, View } from 'react-native';
import { useAsync } from '@/hooks/useAsync';
import { lookupInvite, rememberInvite } from '@/lib/referral';

// 08 · Приглашение по ссылке
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data, loading, error } = useAsync(() => lookupInvite(code ?? ''), [code]);
  useEffect(() => {
    if (!loading && (error || !data)) router.replace('/invite-not-found');
    if (data && code) rememberInvite(code);
  }, [loading, error, data, code]);
  if (loading || !data) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <Title kicker="ПРИГЛАШЕНИЕ RENVI" heading="Друг хочет познакомить" sub="Создайте аккаунт, чтобы открыть приглашение. Код привяжется к регистрации автоматически." />
      <Card>
        <Row>
          <Avatar />
          <View><Bold>Приглашение от {data.name ?? 'друга'}</Bold><Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>Ссылка персональная · безопасная</Text></View>
        </Row>
      </Card>
      <Btn label="Продолжить регистрацию" onPress={() => router.push('/signup')} />
      <Btn kind="ghost" label="У меня уже есть аккаунт" onPress={() => router.push('/signin')} />
      <Btn kind="ghost" label="Проблема со ссылкой" onPress={() => router.push('/invite-not-found')} />
    </Screen>
  );
}
