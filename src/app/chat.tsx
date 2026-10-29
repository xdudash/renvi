import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, BackLink, Between, Card, Choice, Eyebrow, LinkBtn, Loading, Pill, SafeBanner, Sheet, TabBar, TopBar, useToast, VerifiedBadge } from '@/components/ui';
import Svg, { Path } from 'react-native-svg';
import { ErrorRetryState } from '@/components/States';
import { useChat, type ChatItem } from '@/lib/chat';
import { api, type MatchContext } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { getDraft, setDraft } from '@/lib/drafts';
import { placeLabel, promptLabel } from '@/lib/catalog';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { effectiveStatus, useVideoAvailable, useVideoCall } from '@/lib/video';
import type { TFunction } from '@/i18n';
import { localeOf } from '@/i18n/current';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const DEFAULT_STARTERS = [['screens.chat.starter1Label', 'screens.chat.starter1Text'], ['screens.chat.starter2Label', 'screens.chat.starter2Text']] as const;

// 44 · Диалог · переписка
// Keyed by conversation: opening another match in the same screen instance (push tap, navigate with new params)
// must not keep the previous conversation's messages, composer text or context.
export default function ChatRoute() {
  const { match } = useLocalSearchParams<{ match: string }>();
  return <Chat key={match ?? ''} match={match} />;
}

function Chat({ match }: { match: string }) {
  const { t } = useLang();
  const { session } = useSession();
  const me = session?.user.id;
  const toast = useToast();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const chat = useChat(match, me);
  const [text, setText] = useState(getDraft(match));
  const [sheet, setSheet] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const storing = useRef(false);
  const c = ctx.data;
  const videoOn = useVideoAvailable() === true;
  const video = useVideoCall(match, videoOn);

  useEffect(() => { setDraft(match, text); }, [match, text]);
  // Back from icebreakers / photo consent / date screens: pick up the chosen opener and fresh context.
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  useReloadOnFocus(() => {
    ctx.reload();
    const stored = getDraft(match);
    if (stored !== textRef.current) setText(stored);
  });

  const lastMine = useMemo(() => [...chat.items].reverse().find((m) => m.sender_id === me && m.state === 'sent'), [chat.items, me]);
  const read = c?.their_read_at && lastMine && c.their_read_at >= lastMine.created_at;

  const send = async () => {
    const v = text.trim();
    if (!v) { toast(t('screens.chat.enterMessage')); return; }
    if (storing.current) return; // double tap while the message is being stored
    storing.current = true;
    // The composer is cleared only once the message is in the offline outbox (chat.send stores it before the request).
    const ok = await chat.send(v, null, () => { setText(''); setDraft(match, ''); storing.current = false; });
    storing.current = false;
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

  // Local outbox remains accessible on a cold offline start, without pretending we loaded the partner's profile.
  if (!c && chat.items.some((m) => m.state !== 'sent')) return (
    <Wrap>
      <BackLink onPress={() => router.navigate('/chats')} />
      <ScrollView contentContainerStyle={s.main}>
        <SafeBanner>{t('chatOffline.saved')}</SafeBanner>
        {chat.items.filter((m) => m.state !== 'sent').map((m) => (
          <Card key={m.client_id}>
            <Text selectable>{m.body ?? t('chatOffline.photo')}</Text>
            <LinkBtn label={t('common.retry')} onPress={() => { chat.retry(m.client_id); ctx.reload(); }} />
          </Card>
        ))}
        <LinkBtn label={t('common.retry')} onPress={ctx.reload} />
      </ScrollView>
    </Wrap>
  );
  if (ctx.loading) return <Wrap><BackLink onPress={() => router.navigate('/chats')} /><Loading /></Wrap>;
  if (!c) return <Wrap><BackLink onPress={() => router.navigate('/chats')} /><ErrorRetryState onRetry={ctx.reload} /></Wrap>;

  const starters = c.opening_moves.length ? c.opening_moves.slice(0, 2).map((m) => [m, m] as [string, string]) : DEFAULT_STARTERS.map(([l, d]) => [t(l), t(d)] as [string, string]);
  const activeToday = c.partner.show_active && c.partner.updated_at && new Date(c.partner.updated_at).toDateString() === new Date().toDateString();

  return (
    <Wrap>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} contentContainerStyle={s.main} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
          <BackLink onPress={() => router.navigate('/chats')} />
          <ChatHeader c={c} activeToday={!!activeToday} onDate={() => router.push({ pathname: '/date-create', params: { match } })} onMore={() => setSheet(true)}
            onVideo={videoOn ? () => router.push({ pathname: '/video-call', params: { match } }) : undefined} />
          {videoOn ? <VideoCallCard c={c} status={effectiveStatus(video.call)} fromMe={video.call?.requested_by === me} /> : null}
          {c.spark?.prompt ? (
            <Card tight>
              <Eyebrow>{c.spark.from_me ? t('screens.chat.eyebrowFromMe') : t('screens.chat.eyebrowFromThem')}</Eyebrow>
              <Text style={{ fontWeight: '700', fontSize: 13 }}>«{promptLabel(t, c.spark.prompt.question)} {c.spark.prompt.answer}»</Text>
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
          <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.attachPhoto')} onPress={attach} style={s.plus}><View style={s.plusH} /><View style={s.plusV} /></Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={t('screens.chat.placeholder')} placeholderTextColor="#aaa" style={s.input} multiline maxLength={2000} accessibilityLabel={t('screens.chat.message')} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.send')} onPress={send} style={[s.send, !text.trim() && { opacity: 0.45 }]}><Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M12 19V5m-6 6 6-6 6 6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg></Pressable>
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

function ChatHeader({ c, activeToday, onDate, onMore, onVideo }: { c: MatchContext; activeToday: boolean; onDate: () => void; onMore: () => void; onVideo?: () => void }) {
  const { t } = useLang();
  const url = useSignedUrl(c.partner.photo);
  const status = c.muted ? t('screens.chat.notificationsOff') : activeToday ? t('screens.chat.activeToday') : '';
  return (
    <View style={s.head}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('screens.chat.openProfile')} onPress={() => router.push({ pathname: '/profile', params: { id: c.partner.id } })} style={s.headAvatar}>
        <Avatar uri={url} size={46} />
        {activeToday ? <View style={s.online} /> : null}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '900', fontSize: 16, color: colors.ink, flexShrink: 1 }} numberOfLines={1}>{c.partner.name}, {c.partner.age}</Text>
          {c.partner.verified ? <VerifiedBadge size={16} /> : null}
        </View>
        <Text style={s.sub}>{[status, c.partner.verified ? t('screens.chat.photoVerified') : ''].filter(Boolean).join(' · ')}</Text>
      </View>
      {onVideo ? <Pressable accessibilityRole="button" accessibilityLabel={t('video.actionA11y')} onPress={onVideo} style={s.pillBtn}><Text style={{ fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{t('video.action')}</Text></Pressable> : null}
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

// Incoming request or an agreed call is shown above the conversation until it is over.
function VideoCallCard({ c, status, fromMe }: { c: MatchContext; status: string | null; fromMe: boolean }) {
  const { t } = useLang();
  if (!(status === 'accepted' || (status === 'requested' && !fromMe))) return null;
  return (
    <Choice onPress={() => router.push({ pathname: '/video-call', params: { match: c.match_id } })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700' }}>{status === 'accepted' ? t('video.chatReady') : t('video.chatIncoming', { name: c.partner.name })}</Text>
        <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('video.chatOpen')}</Text>
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
      {showDay ? <View style={s.dayPill}><Text style={s.dayText}>{dayLabel(m.created_at, t)}</Text></View> : null}
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
        {!deleted && m.state === 'sent' ? <Text style={[s.stamp, mine && { color: 'rgba(255,255,255,0.75)' }]}>{time(m.created_at)}</Text> : null}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  headAvatar: { position: 'relative' },
  online: { position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#3fb36b', borderWidth: 2, borderColor: colors.paper },
  dayPill: { alignSelf: 'center', backgroundColor: '#ece8e1', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, marginVertical: 10 },
  dayText: { fontSize: 10, fontWeight: '700', color: colors.sub, letterSpacing: 0.5 },
  stamp: { fontSize: 9, color: colors.muted, alignSelf: 'flex-end', marginTop: 3 },
  plusH: { position: 'absolute', width: 14, height: 2.2, borderRadius: 2, backgroundColor: colors.ink },
  plusV: { position: 'absolute', width: 2.2, height: 14, borderRadius: 2, backgroundColor: colors.ink },
  sub: { fontSize: 10, color: colors.sub, marginTop: 3 },
  pillBtn: { height: 44, paddingHorizontal: 11, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tiny: { fontSize: 10, color: colors.muted, marginVertical: 4 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 7, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: '#ebe6df', marginVertical: 4, alignSelf: 'flex-start', shadowColor: '#201E1D', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.red, borderColor: colors.red, borderBottomLeftRadius: 20, borderBottomRightRadius: 6 },
  note: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  bubbleText: { fontSize: 15, lineHeight: 21, color: colors.ink },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 4, backgroundColor: colors.paper },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e4e0d8', backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 15, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', shadowColor: colors.red, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
});
