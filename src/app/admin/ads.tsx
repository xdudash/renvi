import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Act, Acts, AdminPage, Badge, Busy, Chip, ErrorNote, Section } from '@/components/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, type AdminAd } from '@/lib/adminApi';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

const input = { color: colors.ink, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, marginBottom: 8 } as const;
const hint = { color: colors.sub, fontSize: 12 } as const;
type Draft = { slot: 'people' | 'rewarded'; partner: string; title: string; body: string; image_url: string; link_url: string };
const EMPTY: Draft = { slot: 'people', partner: '', title: '', body: '', image_url: '', link_url: '' };

// Partner ads shown to Free accounts (between people and before a rewarded +5). Plus never sees them.
export default function AdminAds() {
  const { t } = useLang();
  const ads = useAsync(() => adminApi.ads(), []);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.partner.trim().length >= 2 && draft.title.trim().length >= 2 && /^https:\/\//.test(draft.link_url.trim()) && (!draft.image_url.trim() || /^https:\/\//.test(draft.image_url.trim()));
  const add = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await adminApi.adSave(null, draft); setDraft(EMPTY); ads.reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const toggle = async (a: AdminAd) => {
    setBusy(true); setError('');
    try { await adminApi.adSave(a.id, { active: !a.active }); ads.reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <AdminPage title={t('adm.ads.title')} sub={t('adm.ads.sub')} right={<Act label={t('adm.common.refresh')} tone="ghost" onPress={ads.reload} />}>
      {ads.error ? <ErrorNote message={t('adm.ads.failed')} onRetry={ads.reload} /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.redDark, marginBottom: 10 }}>{error}</Text> : null}
      <Section title={t('adm.ads.new')}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Chip label={t('adm.ads.slotPeople')} on={draft.slot === 'people'} onPress={() => set('slot', 'people')} />
          <Chip label={t('adm.ads.slotRewarded')} on={draft.slot === 'rewarded'} onPress={() => set('slot', 'rewarded')} />
        </View>
        <TextInput style={input} value={draft.partner} onChangeText={(v) => set('partner', v)} placeholder={t('adm.ads.partner')} accessibilityLabel={t('adm.ads.partner')} />
        <TextInput style={input} value={draft.title} onChangeText={(v) => set('title', v)} placeholder={t('adm.ads.adTitle')} accessibilityLabel={t('adm.ads.adTitle')} />
        <TextInput style={input} value={draft.body} onChangeText={(v) => set('body', v)} placeholder={t('adm.ads.body')} accessibilityLabel={t('adm.ads.body')} multiline />
        <TextInput style={input} value={draft.image_url} onChangeText={(v) => set('image_url', v)} placeholder={t('adm.ads.image')} accessibilityLabel={t('adm.ads.image')} autoCapitalize="none" autoCorrect={false} />
        <TextInput style={input} value={draft.link_url} onChangeText={(v) => set('link_url', v)} placeholder={t('adm.ads.link')} accessibilityLabel={t('adm.ads.link')} autoCapitalize="none" autoCorrect={false} />
        <Text style={[hint, { marginBottom: 8 }]}>{t('adm.ads.hint')}</Text>
        <Act label={busy ? t('adm.dialog.working') : t('adm.ads.add')} onPress={add} disabled={!valid || busy} tone="green" />
      </Section>
      {ads.loading && !ads.data ? <Busy /> : null}
      {ads.data?.length === 0 ? <Text style={hint}>{t('adm.ads.empty')}</Text> : null}
      {ads.data?.map((a) => (
        <Section key={a.id} title={a.title} right={<Badge label={a.active ? t('adm.ads.on') : t('adm.ads.off')} tone={a.active ? 'green' : 'plain'} />}>
          <Text style={hint}>{a.slot === 'people' ? t('adm.ads.slotPeople') : t('adm.ads.slotRewarded')} · {a.partner}</Text>
          <Text style={hint} selectable>{a.link_url}</Text>
          <Text style={[hint, { marginVertical: 6 }]}>{t('adm.ads.stats', { views: a.impressions, clicks: a.clicks })}</Text>
          <Acts><Act label={a.active ? t('adm.ads.switchOff') : t('adm.ads.switchOn')} tone={a.active ? 'ghost' : 'green'} onPress={() => toggle(a)} disabled={busy} /></Acts>
        </Section>
      ))}
    </AdminPage>
  );
}
