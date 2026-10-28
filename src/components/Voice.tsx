// Voice messages: hold-to-record button, preview before sending, and an inline player with progress.
// Built on expo-audio (SDK 58): useAudioRecorder / useAudioRecorderState for recording,
// useAudioPlayer / useAudioPlayerStatus for playback.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { signed } from '@/hooks/useSignedUrl';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

export const VOICE_MAX_MS = 120_000;
const VOICE_MIN_MS = 1_000;

// AAC in an .m4a container (server accepts only <uid>/voice/<uuid>.m4a). Mono at 64 kbit/s is plenty for speech
// (≈1 MB for 2 minutes). Kept in the cache directory: if the OS clears it before an offline retry, the
// message stays "not sent" and can be discarded.
const VOICE_PRESET: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };

export const formatVoiceTime = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

type RecorderEvents = { onTooShort: () => void; onPermissionDenied: () => void; onError: () => void; onMaxReached: () => void };

// Recording state machine: idle → recording (while the button is held) → preview (until sent or discarded).
export function useVoiceRecorder(ev: RecorderEvents) {
  const recorder = useAudioRecorder(VOICE_PRESET);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<{ uri: string; durationMs: number } | null>(null);
  const holding = useRef(false);
  const active = useRef(false);
  const startedAt = useRef(0);
  const evRef = useRef(ev);
  useEffect(() => { evRef.current = ev; }, [ev]);

  const stop = useCallback(async (reason: 'release' | 'max' = 'release') => {
    holding.current = false;
    if (!active.current) return;
    active.current = false;
    setRecording(false);
    const ms = Math.min(VOICE_MAX_MS, Date.now() - startedAt.current);
    try { await recorder.stop(); } catch { /* already stopped by forDuration */ }
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (reason === 'max') evRef.current.onMaxReached();
    if (ms < VOICE_MIN_MS || !recorder.uri) { evRef.current.onTooShort(); return; }
    setPreview({ uri: recorder.uri, durationMs: ms });
  }, [recorder]);

  const start = useCallback(async () => {
    if (active.current || preview) return;
    holding.current = true;
    try {
      const perm = await getRecordingPermissionsAsync();
      if (!perm.granted) {
        // The system dialog ends this press; once granted, the user holds the button again.
        holding.current = false;
        const asked = await requestRecordingPermissionsAsync();
        if (!asked.granted) evRef.current.onPermissionDenied();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!holding.current) { setAudioModeAsync({ allowsRecording: false }).catch(() => {}); evRef.current.onTooShort(); return; }
      recorder.record({ forDuration: VOICE_MAX_MS / 1000 });
      startedAt.current = Date.now();
      active.current = true;
      setRecording(true);
    } catch {
      holding.current = false;
      active.current = false;
      setRecording(false);
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      evRef.current.onError();
    }
  }, [recorder, preview]);

  // Hard stop at 2 minutes even while the button is still held.
  useEffect(() => {
    if (!recording) return;
    const timer = setTimeout(() => { stop('max'); }, Math.max(0, VOICE_MAX_MS - (Date.now() - startedAt.current)));
    return () => clearTimeout(timer);
  }, [recording, stop]);

  const elapsedMs = recording ? Math.min(VOICE_MAX_MS, Math.max(state.durationMillis, 0)) : 0;
  return { recording, elapsedMs, preview, start, stop, clearPreview: () => setPreview(null) };
}

export function VoiceHoldButton({ onPressIn, onPressOut, recording }: { onPressIn: () => void; onPressOut: () => void; recording: boolean }) {
  const { t } = useLang();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('voice.holdToRecord')}
      accessibilityHint={t('voice.holdHint')}
      accessibilityState={{ busy: recording }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={6}
      style={[s.mic, recording && s.micOn]}
    >
      <Text style={{ color: '#fff', fontSize: 16 }}>{recording ? '●' : '🎙'}</Text>
    </Pressable>
  );
}

export function RecordingIndicator({ elapsedMs }: { elapsedMs: number }) {
  const { t } = useLang();
  return (
    <View style={s.recBar} accessibilityLiveRegion="polite">
      <Text style={{ color: colors.red, fontSize: 13, fontWeight: '700' }}>{t('voice.recording', { time: formatVoiceTime(elapsedMs) })}</Text>
      <Text style={{ color: colors.sub, fontSize: 10, marginTop: 2 }}>{t('voice.releaseToStop')} · {formatVoiceTime(VOICE_MAX_MS)}</Text>
    </View>
  );
}

export function VoicePreview({ uri, durationMs, onDiscard, onSend }: { uri: string; durationMs: number; onDiscard: () => void; onSend: () => void }) {
  const { t } = useLang();
  return (
    <View style={s.previewRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.discard')} onPress={onDiscard} style={s.round}><Text style={{ fontSize: 15 }}>✕</Text></Pressable>
      <View style={s.previewBox}>
        <Text style={{ fontSize: 10, color: colors.sub, marginBottom: 4 }}>{t('voice.previewTitle')}</Text>
        <VoicePlayer source={uri} durationMs={durationMs} mine={false} autoPlay={false} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.send')} onPress={onSend} style={s.send}><Text style={{ color: '#fff', fontSize: 17 }}>↑</Text></Pressable>
    </View>
  );
}

// Inline voice message. The player (and the signed URL) is created only on the first tap, so a long
// conversation does not open one native player per bubble.
export function VoiceMessage({ path, localUri, durationMs, mine }: { path: string | null; localUri?: string | null; durationMs: number; mine: boolean }) {
  const { t } = useLang();
  const [opened, setOpened] = useState(false);
  if (!opened) {
    return <VoiceRow mine={mine} playing={false} progress={0} label={formatVoiceTime(durationMs)} a11y={t('voice.message', { time: formatVoiceTime(durationMs) })} onToggle={() => setOpened(true)} />;
  }
  if (localUri) return <VoicePlayer source={localUri} durationMs={durationMs} mine={mine} autoPlay />;
  return <RemoteVoice path={path} durationMs={durationMs} mine={mine} />;
}

function RemoteVoice({ path, durationMs, mine }: { path: string | null; durationMs: number; mine: boolean }) {
  const { t } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!path) { setFailed(true); return; }
    signed(path).then((u) => alive && setUrl(u), () => alive && setFailed(true));
    return () => { alive = false; };
  }, [path]);
  if (failed) return <Text style={[s.time, mine && { color: '#ffe4df' }]}>{t('voice.unavailable')}</Text>;
  if (!url) return <VoiceRow mine={mine} playing={false} progress={0} label={t('voice.loading')} a11y={t('voice.loading')} loading />;
  return <VoicePlayer key={url} source={url} durationMs={durationMs} mine={mine} autoPlay />;
}

// Only one voice message plays at a time.
let current: { pause: () => void } | null = null;

function VoicePlayer({ source, durationMs, mine, autoPlay }: { source: string; durationMs: number; mine: boolean; autoPlay: boolean }) {
  const { t } = useLang();
  const player = useAudioPlayer({ uri: source }, { updateInterval: 250 });
  const st = useAudioPlayerStatus(player);
  const want = useRef(autoPlay);
  const self = useRef({ pause: () => { want.current = false; try { player.pause(); } catch { /* released */ } } });

  const play = useCallback(() => {
    if (current && current !== self.current) current.pause();
    current = self.current;
    want.current = true;
    if (st.isLoaded) player.play();
  }, [player, st.isLoaded]);

  // Start once the file is loaded (autoplay after the first tap).
  useEffect(() => { if (st.isLoaded && want.current && !st.playing) play(); }, [st.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!st.didJustFinish) return;
    want.current = false;
    player.pause();
    player.seekTo(0).catch(() => {});
  }, [st.didJustFinish, player]);
  useEffect(() => () => { if (current === self.current) current = null; }, []);

  const total = st.duration > 0 ? st.duration : durationMs / 1000;
  const progress = total > 0 ? Math.min(1, st.currentTime / total) : 0;
  const label = st.playing || st.currentTime > 0 ? formatVoiceTime(st.currentTime * 1000) : formatVoiceTime(total * 1000);
  return (
    <VoiceRow
      mine={mine}
      playing={st.playing}
      progress={progress}
      label={label}
      loading={!st.isLoaded && want.current}
      a11y={st.playing ? t('voice.pause') : t('voice.play')}
      onToggle={() => { if (st.playing) self.current.pause(); else play(); }}
    />
  );
}

function VoiceRow({ mine, playing, progress, label, a11y, onToggle, loading }: {
  mine: boolean; playing: boolean; progress: number; label: string; a11y: string; onToggle?: () => void; loading?: boolean;
}) {
  const fg = mine ? '#fff' : colors.ink;
  return (
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ busy: !!loading }} onPress={onToggle} disabled={!onToggle} style={[s.play, mine && s.playMine]}>
        {loading ? <ActivityIndicator size="small" color={mine ? colors.red : '#fff'} /> : <Text style={{ color: mine ? colors.red : '#fff', fontSize: 13 }}>{playing ? '❚❚' : '▶'}</Text>}
      </Pressable>
      <View
        style={[s.track, { backgroundColor: mine ? 'rgba(255,255,255,0.35)' : colors.line }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: fg, borderRadius: 2 }} />
      </View>
      <Text style={[s.time, { color: mine ? '#ffe4df' : colors.sub }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  mic: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: colors.red, transform: [{ scale: 1.15 }] },
  recBar: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.red, backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 13, justifyContent: 'center' },
  previewRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  previewBox: { flex: 1, borderWidth: 1, borderColor: '#e4e0d8', backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 190 },
  play: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  playMine: { backgroundColor: '#fff' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  time: { fontSize: 10, minWidth: 30, textAlign: 'right' },
});
