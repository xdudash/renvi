import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, BackLink, Between, Card, Choice, Eyebrow, LinkBtn, Loading, Pill, SafeBanner, Sheet, TabBar, TopBar, useToast } from '@/components/ui';
import { ErrorRetryState } from '@/components/States';
import { useChat, type ChatItem } from '@/lib/chat';
import { api, type MatchContext } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { getDraft, setDraft } from '@/lib/drafts';
import { placeLabel } from '@/lib/catalog';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import type { TFunction } from '@/i18n';
import { localeOf } from '@/i18n/current';

const DEFAULT_STARTERS = [['screens.chat.starter1Label', 'screens.chat.starter1Text'], ['screens.chat.starter2Label', 'screens.chat.starter2Text']] as const;

// 44 · Диалог · переписка (also 45 · История сообщений via ?history=1)
export default function Chat() {
  const { t } = useLang();
  const { match, history } = useLocalSearchParams<{ match: string; history?: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const toast = useToast();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const chat = useChat(match, me);
  const [text, setText] = useState(getDraft(match));
  const [sheet, setSheet] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const c = ctx.data;

  useEffect(() => { if (history) chat.loadOlder(); }, [history]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(match, text); }, [match, text]);

  const lastMine = useMemo(() => [...chat.items].reverse().find((m) => m.sender_id === me && m.state === 'sent'), [chat.items, me]);
  const read = c?.their_read_at && lastMine && c.their_read_at >= lastMine.created_at;

  const send = async () => {
    const v = text.trim();
    if (!v) { toast(t('screens.chat.enterMessage')); return; }
    setText(''); setDraft(match, '');
    const ok = await chat.send(v);
    if (!ok) toast(t('screens.chat.sendFailed'));
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };
  const attach = async () => {
    if (!c?.my_photo_consent || !c?.their_photo_consent) { router.push({ pathname: '/photo-consent', params: { match } }); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast(t('screens.chat.photoPermission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0] || !me) return;
    try {
      const path = await api.uploadPhoto(me, res.assets[0].uri, res.assets[0].mimeType ?? 'image/jpeg', 'chat');
      const ok = await chat.send(null, path);
      if (!ok) router.push({ pathname: '/photo-failed', params: { match } });
    } catch {
      router.push({ pathname: '/photo-failed', params: { match } });
    }
  };

  if (ctx.loading) return <Wrap><BackLink onPress={() => router.navigate('/chats')} /><Loading /></Wrap>;
  if (!c) return <Wrap><BackLink onPress={() => router.navigate('/chats')} /><ErrorRetryState onRetry={ctx.reload} /></Wrap>;

  const starters = c.opening_moves.length ? c.opening_moves.slice(0, 2).map((m) => [m, m] as [string, string]) : DEFAULT_STARTERS.map(([l, d]) => [t(l), t(d)] as [string, string]);
  const activeToday = c.partner.show_active && c.partner.updated_at && new Date(c.partner.updated_at).toDateString() === new Date().toDateString();

  return (
    <Wrap>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} contentContainerStyle={s.main} onContentSizeChange={() => !history && scroll.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
          <BackLink onPress={() => router.navigate('/chats')} />
          <ChatHeader c={c} activeToday={!!activeToday} onDate={() => router.push({ pathname: '/date-create', params: { match } })} onMore={() => setSheet(true)} />
          {c.spark?.prompt ? (
            <Card tight>
              <Eyebrow>{c.spark.from_me ? t('screens.chat.eyebrowFromMe') : t('screens.chat.eyebrowFromThem')}</Eyebrow>
              <Text style={{ fontWeight: '700', fontSize: 13 }}>«{c.spark.prompt.question} {c.spark.prompt.answer}»</Text>
              <LinkBtn label={t('screens.chat.openProfile')} onPress={() => router.push({ pathname: '/profile', params: { id: c.partner.id } })} />
            </Card>
          ) : null}
          {c.latest_date && c.latest_date.status !== 'cancelled' ? <DateCard c={c} me={me} /> : null}
          <View style={{ paddingVertical: 12 }}>
            {chat.hasOlder && chat.items.length >= 50 ? <LinkBtn label={chat.loadingOlder ? t('screens.chat.loadingHistory') : t('screens.chat.showEarlier')} onPress={chat.loadOlder} /> : null}
            {chat.loadingOlder ? <View style={[s.bubble, s.note]}><Text style={{ fontSize: 10, color: '#7d7971' }}>{t('screens.chat.loadingHistory')}</Text></View> : null}
            {chat.loading ? <Loading label={t('screens.chat.loadingMessages')} /> : null}
            {chat.error ? <ErrorRetryState onRetry={chat.reload} /> : null}
            {chat.items.map((m, i) => (
              <Bubble key={m.client_id + m.sender_id} m={m} mine={m.sender_id === me} showDay={i === 0 || new Date(chat.items[i - 1].created_at).toDateString() !== new Date(m.created_at).toDateString()}
                onLong={() => router.push({ pathname: '/message-actions', params: { match, id: m.id, mine: m.sender_id === me ? '1' : '0', body: m.body ?? '' } })}
                onRetry={() => router.push({ pathname: '/message-failed', params: { match, client: m.client_id, body: m.body ?? '' } })}
              />
            ))}
            {read && lastMine ? <Text style={[s.tiny, { textAlign: 'right' }]}>{t('screens.chat.read', { time: time(c.their_read_at!) })}</Text> : null}
          </View>
          <Card tight>
            <Between><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.chat.starterQuestion')}</Text><LinkBtn label={t('screens.chat.configureTopics')} onPress={() => router.push('/opening-moves')} /></Between>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {starters.map(([label, draft]) => <Pill key={label} label={label} onPress={() => setText(draft)} />)}
              <Pill label={t('screens.chat.moreIdeas')} onPress={() => router.push({ pathname: '/icebreakers', params: { match } })} />
            </View>
          </Card>
          {!(c.my_photo_consent && c.their_photo_consent) ? <SafeBanner>{t('screens.chat.photoConsentBanner')}</SafeBanner> : null}
        </ScrollView>
        <View style={s.composer}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.attachPhoto')} onPress={attach} style={s.plus}><Text style={{ fontSize: 17 }}>＋</Text></Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={t('screens.chat.placeholder')} placeholderTextColor="#aaa" style={s.input} multiline maxLength={2000} accessibilityLabel={t('screens.chat.message')} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.send')} onPress={send} style={s.send}><Text style={{ color: '#fff', fontSize: 17 }}>↑</Text></Pressable>
        </View>
        <View style={[s.main, { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 0, paddingBottom: 4 }]}>
          <LinkBtn label={t('screens.chat.proposeDate')} onPress={() => router.push({ pathname: '/date-create', params: { match } })} />
          <LinkBtn label={t('screens.chat.safety')} onPress={() => router.push({ pathname: '/safety', params: { profile: c.partner.id, match } })} />
        </View>
      </KeyboardAvoidingView>
      <ChatActionsSheet visible={sheet} onClose={() => setSheet(false)} c={c} reload={ctx.reload} />
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top', 'bottom']}>
      <TopBar />
      <View style={{ flex: 1 }}>{children}</View>
      <TabBar active="chats" />
    </SafeAreaView>
  );
}

function ChatHeader({ c, activeToday, onDate, onMore }: { c: MatchContext; activeToday: boolean; onDate: () => void; onMore: () => void }) {
  const { t } = useLang();
  const url = useSignedUrl(c.partner.photo);
  const status = c.muted ? t('screens.chat.notificationsOff') : activeToday ? t('screens.chat.activeToday') : '';
  return (
    <View style={s.head}>
      <Avatar uri={url} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13 }}>{c.partner.name}, {c.partner.age}</Text>
        <Text style={s.sub}>{[status, c.partner.verified ? t('screens.chat.photoVerified') : ''].filter(Boolean).join(' · ')}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.proposeDateA11y')} onPress={onDate} style={s.icon}><Text>⌑</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.manageChat')} onPress={onMore} style={s.icon}><Text>···</Text></Pressable>
    </View>
  );
}

function DateCard({ c, me }: { c: MatchContext; me?: string }) {
  const { t } = useLang();
  const d = c.latest_date!;
  const mine = d.proposer_id === me;
  const route = d.status === 'accepted' ? '/date-accepted' : d.status === 'declined' ? '/date-declined' : mine ? '/date-pending' : '/date-incoming';
  const label = d.status === 'accepted' ? t('screens.chat.dateAccepted') : d.status === 'declined' ? t('screens.chat.dateDeclined') : mine ? t('screens.chat.dateAwaitingThem') : t('screens.chat.dateAwaitingYou');
  return (
    <Choice onPress={() => router.push({ pathname: route as never, params: { match: c.match_id, date: d.id } })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700' }}>⌑ {placeLabel(d.place_key, d.place_custom, t)}</Text>
        <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{label} · {d.day} · {d.starts_at.slice(0, 5)}</Text>
      </View>
      <Text>›</Text>
    </Choice>
  );
}

function Bubble({ m, mine, showDay, onLong, onRetry }: { m: ChatItem; mine: boolean; showDay: boolean; onLong: () => void; onRetry: () => void }) {
  const { t } = useLang();
  const photo = useSignedUrl(m.photo_path);
  const deleted = !!m.deleted_at;
  return (
    <>
      {showDay ? <Text style={[s.tiny, { textAlign: 'center' }]}>{dayLabel(m.created_at, t)} · {time(m.created_at)}</Text> : null}
      <Pressable
        accessibilityRole="text"
        accessibilityHint={t('screens.chat.longPressHint')}
        onLongPress={deleted ? undefined : onLong}
        onPress={m.state === 'failed' ? onRetry : undefined}
        style={[s.bubble, mine && s.mine, deleted && s.note]}
      >
        {deleted ? <Text style={{ fontSize: 10, color: '#7d7971' }}>{mine ? t('screens.chat.youDeleted') : t('screens.chat.deleted')}</Text> : null}
        {!deleted && photo ? <Image source={{ uri: photo }} style={{ width: 200, height: 200, borderRadius: 12 }} accessibilityLabel={t('screens.chat.photoInChat')} /> : null}
        {!deleted && m.body ? <Text style={[s.bubbleText, mine && { color: '#fff' }]}>{m.body}</Text> : null}
        {mine && !deleted && m.state !== 'sent' ? (
          <Text style={{ fontSize: 10, color: '#ffe4df', marginTop: 3 }}>{m.state === 'sending' ? t('screens.chat.sending') : t('screens.chat.notSent')}</Text>
        ) : null}
      </Pressable>
    </>
  );
}

function ChatActionsSheet({ visible, onClose, c, reload }: { visible: boolean; onClose: () => void; c: MatchContext; reload: () => void }) {
  const { t } = useLang();
  const toast = useToast();
  const go = (path: string, params?: Record<string, string>) => { onClose(); router.push({ pathname: path as never, params: { match: c.match_id, ...params } }); };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -1, marginBottom: 8 }}>{t('screens.chat.manageChat')}</Text>
      <Choice onPress={async () => { onClose(); try { await api.matchSettings(c.match_id, { archived: true }); router.navigate('/archive'); } catch { toast(t('screens.chat.archiveFailed')); } }}><Text style={{ fontSize: 12 }}>{t('screens.chat.archiveAction')}</Text><Text>›</Text></Choice>
      <Choice onPress={async () => { onClose(); try { await api.matchSettings(c.match_id, { muted: !c.muted }); toast(!c.muted ? t('screens.chat.notificationsOff') : t('screens.chat.notificationsOn')); reload(); if (!c.muted) router.push({ pathname: '/muted', params: { match: c.match_id } }); } catch { toast(t('screens.chat.changeFailed')); } }}><Text style={{ fontSize: 12 }}>{c.muted ? t('screens.chat.unmuteAction') : t('screens.chat.muteAction')}</Text><Text>›</Text></Choice>
      <Choice onPress={() => go('/unmatch')}><Text style={{ fontSize: 12 }}>{t('screens.chat.endMatch')}</Text><Text>›</Text></Choice>
      <Choice onPress={() => go('/safety', { profile: c.partner.id })}><Text style={{ fontSize: 12 }}>{t('screens.chat.safetyAndReport')}</Text><Text>›</Text></Choice>
      <Choice onPress={() => go('/support-share')}><Text style={{ fontSize: 12 }}>{t('screens.chat.writeSupport')}</Text><Text>›</Text></Choice>
    </Sheet>
  );
}

export const time = (iso: string) => new Date(iso).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string, t: TFunction) => {
  const d = new Date(iso), today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t('screens.chat.today');
  if (d.toDateString() === y.toDateString()) return t('screens.chat.yesterday');
  return d.toLocaleDateString(localeOf(), { day: 'numeric', month: 'long' }).toUpperCase();
};

const s = StyleSheet.create({
  main: { paddingHorizontal: 18, paddingTop: 5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 4, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  sub: { fontSize: 10, color: colors.sub, marginTop: 3 },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tiny: { fontSize: 10, color: colors.muted, marginVertical: 4 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 11, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 4, backgroundColor: '#EAE6E0', marginVertical: 7, alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.red, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  note: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  bubbleText: { fontSize: 13, lineHeight: 19, color: colors.ink },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 4, backgroundColor: colors.paper },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e4e0d8', backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, maxHeight: 120 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
});
