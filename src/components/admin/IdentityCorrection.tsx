import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Act, Chip, Section, errText, useLock } from '@/components/AdminUI';
import { adminApi } from '@/lib/adminApi';
import { GENDERS } from '@/lib/catalog';
import { ageOnDate } from '@/lib/identity';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const label = { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.eyebrow, marginTop: 10, marginBottom: 5 } as const;
const input = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.ink, backgroundColor: colors.white } as const;

// Date of birth and gender are locked for the user; only an admin can correct them, with a reason that goes to the audit log.
// The server needs both values, so the current gender is pre-selected and only the date has to be typed.
export default function IdentityCorrection({ userId, gender: current, age, onSaved }: {
  userId: string; gender: string | null; age: number | null; onSaved?: () => void | Promise<void>;
}) {
  const { t } = useLang();
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState(current ?? '');
  const [reason, setReason] = useState('');
  const [busy, run] = useLock();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => run(async () => {
    const years = ageOnDate(birthdate);
    if (years === null || years < 18 || years > 120 || !GENDERS.some((g) => g.key === gender) || reason.trim().length < 3) {
      setMessage({ ok: false, text: t('adm.identity.invalid') });
      return;
    }
    setMessage(null);
    try {
      await adminApi.correctIdentity(userId, birthdate, gender, reason.trim());
      setMessage({ ok: true, text: t('adm.identity.saved') });
      setBirthdate(''); setReason('');
      await onSaved?.();
    } catch (e) {
      setMessage({ ok: false, text: t('adm.common.error', { message: errText(e) }) });
    }
  });
  return (
    <Section title={t('adm.identity.title')}>
      <Text style={{ fontSize: 12, color: colors.sub }}>{t('adm.identity.note', { age: age ?? '—' })}</Text>
      <Text style={label}>{t('adm.identity.birthday')}</Text>
      <TextInput value={birthdate} onChangeText={setBirthdate} placeholder="1998-08-12" autoCapitalize="none" autoCorrect={false} maxLength={10}
        accessibilityLabel={t('adm.identity.birthday')} style={input} />
      <Text style={label}>{t('adm.identity.gender')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {GENDERS.map((g) => <Chip key={g.key} label={g.label} on={gender === g.key} onPress={() => setGender(g.key)} />)}
      </View>
      <Text style={label}>{t('adm.identity.reason')}</Text>
      <TextInput value={reason} onChangeText={setReason} multiline maxLength={1000} accessibilityLabel={t('adm.identity.reason')}
        style={[input, { minHeight: 70, textAlignVertical: 'top' }]} />
      {message ? <Text accessibilityRole="alert" style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: message.ok ? colors.green : colors.redDark }}>{message.text}</Text> : null}
      <View style={{ marginTop: 10 }}><Act label={busy ? t('adm.dialog.working') : t('adm.identity.save')} onPress={save} disabled={busy} /></View>
    </Section>
  );
}
