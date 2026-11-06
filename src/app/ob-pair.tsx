import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { BackLink, Btn, Card, Eyebrow, ErrorBlock, Field, LinkBtn, Loading, Screen, Segmented, Tiny, Title, useToast } from '@/components/ui';
import { StepList } from '@/components/Kit';
import { UiIcon } from '@/components/UiIcon';
import { api, type CoupleInfo } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// ob-pair · «Свяжите профили» — one person creates a 48-hour code, the other enters it and confirms. Used during
// onboarding (after choosing "Мы пара") and later from «Где меня видно».
const norm = (v: string) => {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return s.length > 3 ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
};

function Side({ name, caption, empty }: { name: string; caption: string; empty?: boolean }) {
  return (
    <View style={s.side}>
      {empty ? <View style={s.emptyAv}><Text style={s.emptyQ}>?</Text></View> : <View style={s.av}><Text style={s.avText}>{name.slice(0, 1).toUpperCase()}</Text></View>}
      <Text style={s.sideName}>{name}</Text>
      <Text style={s.sideSmall}>{caption}</Text>
    </View>
  );
}

export default function ObPair() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const [tab, setTab] = useState<'invite' | 'code'>('invite');
  const [couple, setCouple] = useState<CoupleInfo | undefined>(undefined);
  const [error, setError] = useState(false);
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [who, setWho] = useState<{ name: string; age: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const inOnboarding = !profile?.onboarding_done;
  const leaveTo = () => router.replace((inOnboarding ? '/ob-age' : '/modes') as never);

  const [tick, setTick] = useState(0);
  const noCode = t('modes.pair.noCode');
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });
  const load = useCallback(() => { setError(false); setTick((n) => n + 1); }, []);
  useEffect(() => {
    let on = true;
    api.myCouple().then(
      (c) => { if (!on) return; setCouple(c); if (c?.status === 'pending' && c.code) setCode(c.code); },
      () => { if (on) setError(true); });
    return () => { on = false; };
  }, [tick]);

  // The invitation code exists only after the first request; ask for it when the person opens the "invite" tab.
  const needCode = tab === 'invite' && couple !== undefined && couple?.status !== 'active' && !code;
  useEffect(() => {
    if (!needCode) return;
    let on = true;
    api.coupleCode().then((r) => { if (on) setCode(r.code); }, () => { if (on) toastRef.current(noCode); });
    return () => { on = false; };
  }, [needCode, noCode]);

  // While waiting for the partner, check now and then whether they have confirmed.
  useEffect(() => {
    if (couple?.status !== 'pending') return;
    const id = setInterval(() => setTick((n) => n + 1), 6000);
    return () => clearInterval(id);
  }, [couple?.status]);

  const preview = async (value: string) => {
    setTyped(value);
    setWho(null);
    if (value.length !== 7) return;
    try {
      const r = await api.couplePreview(value);
      if (!alive.current) return;
      if (r.found) setWho({ name: r.name ?? '', age: r.age ?? null }); else toast(t('modes.pair.notFound'));
    } catch (e: any) { toast(e?.code === 'P0006' || /too many/.test(e?.message ?? '') ? t('modes.pair.tooMany') : t('modes.saveFail')); }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.coupleAccept(typed);
      if (!r.found) { toast(t('modes.pair.notFound')); return; }
      toast(t('modes.pair.linked'));
      await refresh();
      await load();
      leaveTo();
    } catch (e: any) {
      toast(e?.code === 'P0005' || /already paired/.test(e?.message ?? '') ? t('modes.pair.already') : e?.code === 'P0006' || /too many/.test(e?.message ?? '') ? t('modes.pair.tooMany') : t('modes.saveFail'));
    } finally { setBusy(false); }
  };
  const leave = async () => {
    setBusy(true);
    try { await api.coupleLeave(); await refresh(); setCouple(null); setCode(''); toast(t('modes.pair.left')); }
    catch { toast(t('modes.saveFail')); }
    finally { setBusy(false); }
  };

  const me = profile?.display_name ?? t('modes.pair.you');
  if (couple === undefined && !error) return <Screen><BackLink /><Loading /></Screen>;
  if (error) return <Screen><BackLink /><ErrorBlock message={t('modes.saveFail')} onRetry={load} /></Screen>;

  if (couple?.status === 'active' && couple.partner) {
    return (
      <Screen>
        <BackLink onPress={leaveTo} />
        <Title kicker={t('modes.pair.kicker')} heading={t('modes.pair.active', { name: couple.partner.name })} sub={t('modes.pair.sub')} />
        <View style={s.viz}>
          <Side name={me} caption={t('modes.pair.you')} />
          <View style={s.link}><UiIcon name="couple" size={20} color={colors.redDark} /></View>
          <Side name={couple.partner.name} caption={couple.partner.age ? String(couple.partner.age) : ''} />
        </View>
        <Btn kind="ghost" label={t('modes.pair.leave')} onPress={leave} busy={busy} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink onPress={() => (inOnboarding ? router.replace('/ob-status') : router.back())} />
      <Title kicker={t('modes.pair.kicker')} heading={t('modes.pair.h')} sub={t('modes.pair.sub')} />
      <View style={s.viz}>
        <Side name={me} caption={t('modes.pair.you')} />
        <View style={s.link}><UiIcon name="couple" size={20} color={colors.redDark} /></View>
        {tab === 'invite' ? <Side name={t('modes.pair.partner')} caption={t('modes.pair.waiting')} empty /> : who ? <Side name={who.name} caption={t('modes.pair.invitedYou')} /> : <Side name="?" caption={t('modes.pair.partner')} empty />}
      </View>
      <Segmented items={[{ key: 'invite', label: t('modes.pair.invite') }, { key: 'code', label: t('modes.pair.have') }]} value={tab} onChange={(k) => setTab(k as 'invite' | 'code')} />
      {tab === 'invite' ? (
        <>
          <Card>
            <Eyebrow>{t('modes.pair.step1')}</Eyebrow>
            <Text style={s.code} selectable accessibilityLabel={code}>{code || '···-···'}</Text>
            <View style={s.two}>
              <View style={{ flex: 1 }}><Btn kind="secondary" label={t('modes.pair.copy')} disabled={!code} onPress={async () => { await Clipboard.setStringAsync(code); toast(t('modes.pair.copied')); }} /></View>
              <View style={{ flex: 1 }}><Btn label={t('modes.pair.send')} disabled={!code} onPress={() => { Share.share({ message: t('modes.pair.shareText', { code }) }).catch(() => toast(t('modes.saveFail'))); }} /></View>
            </View>
            <Tiny center>{t('modes.pair.valid')}</Tiny>
          </Card>
          <Card tight>
            <Eyebrow>{t('modes.pair.next')}</Eyebrow>
            <StepList items={[t('modes.pair.s1'), t('modes.pair.s2', { code: code || '···-···' }), t('modes.pair.s3')]} />
          </Card>
          <Btn label={t('modes.pair.wait')} onPress={leaveTo} />
        </>
      ) : (
        <>
          <Field label={t('modes.pair.codeLabel')} value={typed} onChangeText={(v) => preview(norm(v))} autoCapitalize="characters" autoCorrect={false} maxLength={7}
            placeholder="K7Q-4MX" style={s.codeInput} />
          {who ? (
            <Card tight>
              <View style={s.row}>
                <View style={s.avSmall}><Text style={s.avText}>{who.name.slice(0, 1).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.who}>{who.name}{who.age ? `, ${who.age}` : ''}</Text>
                  <Text style={s.whoSub}>{t('modes.pair.wants')}</Text>
                </View>
              </View>
            </Card>
          ) : null}
          <Btn label={t('modes.pair.confirm')} disabled={!who} onPress={confirm} busy={busy} />
        </>
      )}
      <LinkBtn center label={t('modes.pair.later')} onPress={leaveTo} />
    </Screen>
  );
}

const s = StyleSheet.create({
  viz: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, marginBottom: 12 },
  side: { width: 96, alignItems: 'center', gap: 2 },
  av: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 18, fontWeight: '800', color: colors.ink },
  emptyAv: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CFC8BF', alignItems: 'center', justifyContent: 'center' },
  emptyQ: { fontSize: 20, fontWeight: '800', color: '#8A847C' },
  sideName: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sideSmall: { fontSize: 10, color: colors.sub, textAlign: 'center' },
  link: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center' },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 5, textAlign: 'center', marginTop: 8, marginBottom: 12, color: colors.ink },
  two: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  codeInput: { fontSize: 20, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { fontSize: 13, fontWeight: '700', color: colors.ink },
  whoSub: { fontSize: 10.5, color: colors.sub },
});
