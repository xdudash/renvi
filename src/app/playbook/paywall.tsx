import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, LinkBtn, Screen } from '@/components/ui';
import { UiIcon } from '@/components/UiIcon';
import { Chat, Label, lessonHref } from '@/components/Playbook';
import { playbookContent } from '@/playbook';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';
import { unlockAfterPurchase, usePlaybook } from '@/lib/playbook';
import { buyPlaybook, playbookPrice, purchasesAvailable, restorePlaybook } from '@/lib/purchases';
import { colors } from '@/theme/tokens';

const FALLBACK_PRICE = '0,99 €';

// One purchase opens lessons 1 and 3–8 for good. The store confirms; the server is updated by playbook-sync.
export default function PlaybookPaywall() {
  const { to } = useLocalSearchParams<{ to?: string }>();
  const target = Math.min(8, Math.max(1, Number(to) || 3));
  const { t, lang } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const p = playbookContent(lang).paywall;
  const [price, setPrice] = useState(FALLBACK_PRICE);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const available = purchasesAvailable();

  useEffect(() => { playbookPrice().then((v) => { if (v) setPrice(v); }); }, []);
  // Bought on another device / restored meanwhile: go straight to the lesson.
  useEffect(() => { if (pb.purchased) router.replace(lessonHref(target, pb) as never); }, [pb, target]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/playbook'));
  const done = () => { unlockAfterPurchase(); };
  const buy = async () => {
    setMsg(null); setBusy('buy');
    const r = await buyPlaybook();
    setBusy(null);
    if (r === 'ok') done(); else if (r === 'error') setMsg(t('playbook.paywallError'));
  };
  const restore = async () => {
    setMsg(null); setBusy('restore');
    const r = await restorePlaybook();
    setBusy(null);
    if (r === 'ok') done(); else setMsg(t(r === 'none' ? 'playbook.paywallRestoreNone' : 'playbook.paywallError'));
  };

  return (
    <Screen tabs="me">
      <View style={s.top}>
        <Label tone="red">{t('playbook.paywallKicker')}</Label>
        <Pressable accessibilityRole="button" accessibilityLabel={t('playbook.close')} onPress={close} hitSlop={10} style={s.close}>
          <UiIcon name="close" size={18} />
        </Pressable>
      </View>
      <Text style={s.h1} accessibilityRole="header">{t('playbook.paywallTitle')}</Text>
      <View style={s.chat}><Chat msgs={p.chat} /></View>
      <View style={{ gap: 9 }}>
        {p.points.map((x, i) => (
          <View key={i} style={s.point}>
            <View style={s.check}><UiIcon name="check" size={13} color="#fff" /></View>
            <Text style={s.pointText}>{x}</Text>
          </View>
        ))}
      </View>
      <Text style={s.price}>{t('playbook.paywallPrice', { price })}</Text>
      {available ? (
        <>
          <Btn label={t('playbook.paywallBuy', { price })} busy={busy === 'buy'} disabled={!!busy} onPress={buy} />
          <LinkBtn center label={t('playbook.paywallRestore')} onPress={() => { if (!busy) restore(); }} />
          <Text style={s.store}>{t(Platform.OS === 'android' ? 'playbook.paywallStoreAndroid' : 'playbook.paywallStoreIos')}</Text>
        </>
      ) : (
        <Text style={s.unavailable}>{t('playbook.paywallUnavailable')}</Text>
      )}
      {msg ? <Text style={s.msg} accessibilityLiveRegion="polite">{msg}</Text> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  h1: { fontSize: 30, fontWeight: '900', letterSpacing: -1.3, lineHeight: 33, color: colors.ink, marginTop: 12 },
  chat: { backgroundColor: colors.surfaceMuted, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 16 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pointText: { flex: 1, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  price: { fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 20, marginBottom: 10 },
  store: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 2 },
  unavailable: { fontSize: 13.5, lineHeight: 19, color: colors.sub, textAlign: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 },
  msg: { fontSize: 13, color: colors.redDark, textAlign: 'center', marginTop: 10 },
});
