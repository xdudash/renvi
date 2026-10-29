import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AdminPage, Act, Badge, Busy, ErrorNote, Section, Tbl, errText, fmtDate, useActionDialog } from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, isEmail, type AdminRow } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// Admin management: only an existing admin adds or removes admins; the server refuses to remove the last one.
export default function AdminAdmins() {
  const { t } = useLang();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [dialog, openDialog] = useActionDialog();
  const { data, error, loading, reload } = useAsync(() => adminApi.admins(), []);
  const only = (data?.length ?? 0) <= 1;

  const add = () => {
    if (!isEmail(email)) { toast(t('adm.cfg.badEmail')); return; }
    openDialog({
      title: t('adm.admins.addTitle', { email: email.trim() }), body: t('adm.admins.addBody'), confirmLabel: t('adm.admins.add'), tone: 'red',
      onConfirm: ({ reason }) => adminApi.addAdmin(email.trim(), reason),
      onDone: () => { setEmail(''); toast(t('adm.admins.added')); reload(); },
    });
  };
  const remove = (a: AdminRow) => openDialog({
    title: t('adm.admins.removeTitle', { email: a.email }), body: a.is_me ? t('adm.admins.removeSelfBody') : t('adm.admins.removeBody'),
    confirmLabel: t('adm.admins.remove'), tone: 'red',
    onConfirm: ({ reason }) => adminApi.removeAdmin(a.user_id, reason),
    onDone: () => { toast(t('adm.admins.removed')); if (a.is_me) router.replace('/'); else reload(); },
  });

  return (
    <AdminPage title={t('adm.admins.title')} sub={t('adm.admins.sub')}>
      {dialog}
      {error ? <ErrorNote message={errText(error)} onRetry={reload} /> : null}
      <Section title={t('adm.admins.addSection')}>
        <Text style={{ fontSize: 12, color: colors.sub, marginBottom: 8 }}>{t('adm.admins.addHint')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            accessibilityLabel={t('adm.admins.email')}
            style={{ flex: 1, minWidth: 220, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, backgroundColor: colors.white, color: colors.ink }} />
          <Act label={t('adm.admins.add')} onPress={add} disabled={!email.trim()} />
        </View>
      </Section>
      {loading && !data ? <Busy /> : null}
      {data ? (
        <Section title={t('adm.admins.list', { n: data.length })}>
          <Tbl widths={[240, 150, 140, 200, 160]} head={[t('adm.admins.email'), t('adm.admins.name'), t('adm.admins.since'), t('adm.admins.addedBy'), '']}
            rows={data.map((a) => [
              <View key="e" style={{ gap: 3 }}><Text style={{ fontSize: 12, color: colors.ink }} selectable>{a.email}</Text>{a.is_me ? <Badge label={t('adm.admins.you')} tone="ink" /> : null}</View>,
              a.name ?? '—', fmtDate(a.created_at), a.added_by_email ?? t('adm.admins.bySql'),
              <Act key="r" label={t('adm.admins.remove')} tone="red" disabled={only} onPress={() => remove(a)} />,
            ])} />
          {only ? <Text style={{ fontSize: 11, color: colors.amber, marginTop: 8 }}>{t('adm.admins.lastNote')}</Text> : null}
        </Section>
      ) : null}
    </AdminPage>
  );
}
