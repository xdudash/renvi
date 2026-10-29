import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink, Btn, Card, Chip, LinkBtn, Loading, SafeBanner, Screen, StateBlock, Tiny, Title, useToast } from '@/components/ui';
import { VideoFrame, ensureCallPermissions } from '@/components/VideoFrame';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { effectiveStatus, useVideoAvailable, useVideoCall, videoApi, VideoError, type JoinInfo } from '@/lib/video';
import type { TranslationKey } from '@/i18n';
import { colors } from '@/theme/tokens';
import { localeOf } from '@/i18n/current';

// Formatted in the selected app language (was hard-coded to ru-RU).
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' });

const CLOSED: Record<string, TranslationKey> = {
  declined: 'video.closedDeclined', expired: 'video.closedExpired', ended: 'video.closedEnded', cancelled: 'video.closedCancelled',
};

// Optional short video call before a date: consent of both members, then Daily Prebuilt in a WebView.
export default function VideoCall() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const toast = useToast();
  const available = useVideoAvailable();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const { call, setCall, loading, reload } = useVideoCall(match);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<(JoinInfo & { callId: string }) | null>(null);
  const status = effectiveStatus(call);
  const name = ctx.data?.partner.name ?? '';
  const toChat = () => router.replace({ pathname: '/chat', params: { match } });

  // The call view closes by itself once the session is over (partner ended it, time ran out, unmatch/block):
  // the session is polled every few seconds while open.
  const inCall = joined && call && joined.callId === call.id && status === 'accepted' ? joined : null;

  const fail = (e: unknown) => {
    const code = e instanceof VideoError ? e.code : null;
    toast(code === 'rate_limited' ? t('video.rateLimited') : code === 'video_unavailable' ? t('video.unavailable') : t('video.failed'));
    reload();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const request = () => run(async () => setCall(await videoApi.request(match)));
  const respond = (a: 'accept' | 'decline') => run(async () => { if (call) setCall(await videoApi.respond(call.id, a)); });
  const end = () => run(async () => { if (call) await videoApi.end(call.id); setJoined(null); reload(); });
  const start = () => run(async () => {
    if (!call) return;
    if (!(await ensureCallPermissions())) { toast(t('video.permissionDenied')); return; }
    setJoined({ ...(await videoApi.join(call.id)), callId: call.id });
  });

  if (inCall) {
    return (
      <SafeAreaView style={s.call} edges={['top', 'bottom']}>
        <View style={s.callBar}>
          <Text style={s.callText}>{name} · {t('video.until', { time: hhmm(inCall.expires_at) })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('video.end')} onPress={end} style={s.endBtn} disabled={busy}>
            <Text style={s.endText}>{t('video.end')}</Text>
          </Pressable>
        </View>
        <VideoFrame url={inCall.url} label={t('video.frameLabel')} />
      </SafeAreaView>
    );
  }

  if (ctx.loading || loading || available === null) return <Screen tabs="chats"><BackLink onPress={toChat} /><Loading /></Screen>;
  if (!available) {
    return (
      <Screen tabs="chats">
        <BackLink onPress={toChat} />
        <StateBlock icon="◌" title={t('video.unavailable')} copy={t('video.sub')} label={t('video.toChat')} onPress={toChat} />
      </Screen>
    );
  }

  const mine = call?.requested_by === me;
  return (
    <Screen tabs="chats">
      <BackLink onPress={toChat} />
      {status === 'requested' && mine ? (
        <>
          <Title kicker={t('video.kicker')} heading={t('video.waitingHeading', { name })} sub={t('video.waitingCopy')} />
          <Card><Chip label={t('video.until', { time: hhmm(call!.expires_at) })} tone="amber" /></Card>
          <Btn kind="ghost" label={t('video.cancelRequest')} busy={busy} onPress={end} />
        </>
      ) : status === 'requested' ? (
        <>
          <Title kicker={t('video.kicker')} heading={t('video.incomingHeading', { name })} sub={t('video.incomingCopy')} />
          <Rules />
          <Btn label={t('video.accept')} busy={busy} onPress={() => respond('accept')} />
          <Btn kind="ghost" label={t('video.decline')} disabled={busy} onPress={() => respond('decline')} />
        </>
      ) : status === 'accepted' ? (
        <>
          <Title kicker={t('video.kicker')} heading={t('video.readyHeading')} sub={t('video.readyCopy', { time: hhmm(call!.expires_at) })} />
          <Rules />
          <Btn label={t('video.start')} busy={busy} onPress={start} />
          <Btn kind="ghost" label={t('video.end')} disabled={busy} onPress={end} />
        </>
      ) : (
        <>
          <Title kicker={t('video.kicker')} heading={t('video.heading')} sub={t('video.sub')} />
          {status && CLOSED[status] ? <Card><Chip label={t(CLOSED[status])} /></Card> : null}
          <Rules />
          <Btn label={status ? t('video.again') : t('video.request')} busy={busy} onPress={request} />
        </>
      )}
      <SafeBanner>{t('video.rule4')}</SafeBanner>
      {ctx.data ? <LinkBtn label={t('video.report')} onPress={() => router.push({ pathname: '/safety', params: { profile: ctx.data!.partner.id, match } })} /> : null}
    </Screen>
  );
}

function Rules() {
  const { t } = useLang();
  return (
    <Card>
      {(['video.rule1', 'video.rule2', 'video.rule3'] as const).map((k) => <Tiny key={k}>• {t(k)}</Tiny>)}
    </Card>
  );
}

const s = StyleSheet.create({
  call: { flex: 1, backgroundColor: '#000' },
  callBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  callText: { color: '#fff', fontSize: 13, flex: 1 },
  endBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  endText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
