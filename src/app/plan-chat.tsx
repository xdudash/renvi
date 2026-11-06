import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackLink, ErrorBlock, Loading, TabBar, TopBar, useToast } from '@/components/ui';
import { UiIcon } from '@/components/UiIcon';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { categoryOf, formatWhen, type Plan, type PlanMessage } from '@/lib/plans';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// plan-chat · group chat of one plan. Only the host and accepted people can read and write (enforced on the server).
export default function PlanChat() {
  const { t } = useLang();
  const toast = useToast();
  const { session } = useSession();
  const me = session?.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);
  const plan = useAsync<Plan>(() => api.planDetail(planId), [planId]);
  const [msgs, setMsgs] = useState<PlanMessage[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(() => {
    api.planChat(planId).then((m) => { setMsgs(m); setFailed(false); }, (e) => { if (e?.kind === 'not_found') setDenied(true); else setFailed(true); });
  }, [planId]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`plan-chat:${planId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plan_messages', filter: `plan_id=eq.${planId}` }, () => load())
      .subscribe((status) => { if (status === 'SUBSCRIBED') load(); });
    return () => { supabase.removeChannel(ch); };
  }, [planId, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try { await api.planChatSend(planId, body); setText(''); load(); }
    catch { toast(t('plans.chat.fail')); }
    finally { setSending(false); }
  };

  const p = plan.data;
  const c = p ? categoryOf(p.category) : null;
  let body: React.ReactNode;
  if (denied) body = <View style={s.main}><BackLink onPress={() => router.back()} /><ErrorBlock message={t('plans.chat.noAccess')} /></View>;
  else if ((!msgs && !failed) || plan.loading) body = <View style={s.main}><BackLink onPress={() => router.back()} /><Loading /></View>;
  else if (failed || !p || !msgs) body = <View style={s.main}><BackLink onPress={() => router.back()} /><ErrorBlock message={t('plans.err.generic')} onRetry={() => { setFailed(false); load(); plan.reload(); }} /></View>;
  else {
    let lastDay = '';
    body = (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={s.iconBtn}><Text style={s.back}>‹</Text></Pressable>
          <View style={[s.cover, { backgroundColor: c!.tint }]}><UiIcon name={c!.icon} size={18} color={c!.ink} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{p.title}</Text>
            <Text style={s.sub}>{t('plans.chat.members', { n: p.going, when: formatWhen(p.starts_at) })}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('plans.chat.info')} onPress={() => router.push({ pathname: '/plan', params: { id: p.id } })} style={s.iconBtn}><Text style={s.info}>i</Text></Pressable>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={s.msgs} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
          {p.place ? <View style={s.pinned}><UiIcon name="pin" size={16} /><Text style={s.pinnedText}>{t('plans.chat.place', { place: p.place })}</Text></View> : null}
          {msgs.length === 0 ? <Text style={s.empty}>{t('plans.chat.empty')}</Text> : null}
          {msgs.map((m) => {
            const day = new Date(m.created_at).toDateString();
            const head = day !== lastDay; lastDay = day;
            const mine = m.user_id === me;
            return (
              <View key={m.id}>
                {head ? <Text style={s.day}>{new Date(m.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }).toUpperCase()}</Text> : null}
                {!mine ? <Text style={s.who}>{m.name}{m.host ? ` · ${t('plans.d.host')}` : ''}</Text> : null}
                <View style={[s.bubble, mine && s.mine]}><Text style={[s.bubbleText, mine && { color: '#fff' }]}>{m.body}</Text></View>
              </View>
            );
          })}
        </ScrollView>
        <View style={s.composer}>
          <TextInput value={text} onChangeText={setText} placeholder={t('plans.chat.ph')} placeholderTextColor="#aaa" style={s.input} multiline maxLength={1000} accessibilityLabel={t('plans.chat.ph')} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('plans.chat.send')} onPress={send} disabled={sending} style={[s.send, (!text.trim() || sending) && { opacity: 0.45 }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M12 19V5m-6 6 6-6 6 6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <TopBar />
      <View style={{ flex: 1 }}>{body}</View>
      <TabBar active="chats" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  main: { paddingHorizontal: 17, paddingTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 17, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 26, color: colors.ink },
  info: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cover: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 10.5, color: colors.sub, marginTop: 1 },
  msgs: { paddingHorizontal: 17, paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' },
  pinned: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 10, marginBottom: 8 },
  pinnedText: { flex: 1, fontSize: 11.5, color: colors.ink },
  empty: { textAlign: 'center', fontSize: 12, color: colors.sub, marginVertical: 16 },
  day: { textAlign: 'center', fontSize: 9, fontWeight: '800', letterSpacing: 1.3, color: colors.sub, marginVertical: 10 },
  who: { fontSize: 9.5, fontWeight: '700', color: colors.sub, marginTop: 6, marginLeft: 4 },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, borderBottomLeftRadius: 5, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginVertical: 3, alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.red, borderColor: colors.red, borderBottomLeftRadius: 15, borderBottomRightRadius: 5 },
  bubbleText: { fontSize: 14, lineHeight: 19, color: colors.ink },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 17, paddingTop: 8, paddingBottom: 4, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, borderWidth: 1, borderColor: '#e4e0d8', backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
});
