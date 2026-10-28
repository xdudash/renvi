import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Bold, Btn, Card, Loading, Row, Screen, Title } from '@/components/ui';
import { Text, View } from 'react-native';
import { useAsync } from '@/hooks/useAsync';
import { lookupInvite, rememberInvite } from '@/lib/referral';
import { useLang } from '@/lib/lang';

// 08 · Приглашение по ссылке
export default function Invite() {
  const { t } = useLang();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data, loading, error } = useAsync(() => lookupInvite(code ?? ''), [code]);
  useEffect(() => {
    if (!loading && (error || !data)) router.replace('/invite-not-found');
    if (data && code) rememberInvite(code);
  }, [loading, error, data, code]);
  if (loading || !data) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <Title kicker={t('screens.inviteInviteCode.priglashenieRenvi')} heading={t('screens.inviteInviteCode.drugHochetPoznakomit')} sub={t('screens.inviteInviteCode.sozdayteAkkauntChtobyOtkry')} />
      <Card>
        <Row>
          <Avatar />
          <View><Bold>{t('screens.inviteInviteCode.priglashenieOtName', { name: data.name ?? t('screens.inviteInviteCode.druga') })}</Bold><Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>{t('screens.inviteInviteCode.ssylkaPersonalnayaBezopasn')}</Text></View>
        </Row>
      </Card>
      <Btn label={t('screens.inviteInviteCode.prodolzhitRegistratsiyu')} onPress={() => router.push('/signup')} />
      <Btn kind="ghost" label={t('screens.inviteInviteCode.uMenyaUzheEst')} onPress={() => router.push('/signin')} />
      <Btn kind="ghost" label={t('screens.inviteInviteCode.problemaSoSsylkoy')} onPress={() => router.push('/invite-not-found')} />
    </Screen>
  );
}
