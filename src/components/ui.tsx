// Shared building blocks. Each one mirrors a class in the approved prototype CSS.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View,
  ViewStyle, StyleProp, AccessibilityInfo, Image,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { BrandMark } from './BrandMark';
import { useLang } from '@/lib/lang';
import type { TranslationKey } from '@/i18n';
import { UiIcon, type IconName } from './UiIcon';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

// ---------- toast ----------
type ToastFn = (message: string) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<ToastFn>((m) => {
    setText(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 1900);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {text ? (
        <View pointerEvents="none" style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{text}</Text>
        </View>
      ) : null}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- layout ----------
export type TabKey = 'discover' | 'likes' | 'chats' | 'me';

// Same rule as the prototype: no tab bar on the first launch, account and onboarding screens.
const NO_TABS = ['/', '/language', '/signin', '/signup', '/forgot', '/captcha', '/confirmation'];
const ME_SCREENS = ['/me', '/edit-', '/opening-moves', '/privacy', '/settings', '/support-help', '/notification-settings', '/legal', '/data-export', '/delete-', '/blocked', '/referral', '/share-sheet', '/verification-', '/account-', '/report', '/appeal', '/community-rules'];
const CHAT_SCREENS = ['/chat', '/icebreakers', '/push-prompt', '/photo-', '/message-', '/archive', '/muted', '/unmatch', '/support-share', '/date-', '/video-call'];
function tabFor(path: string): TabKey {
  if (path.startsWith('/likes') || path === '/incoming-profile' || path === '/match') return 'likes';
  if (CHAT_SCREENS.some((p) => path.startsWith(p))) return 'chats';
  if (ME_SCREENS.some((p) => path.startsWith(p))) return 'me';
  return 'discover';
}

export function Screen({ children, scroll = true, tabs, style }: {
  children: React.ReactNode; scroll?: boolean; tabs?: TabKey; style?: StyleProp<ViewStyle>;
}) {
  const path = usePathname();
  const { session } = useSession();
  const compactBar = path === '/';
  const showTabs = !!session && !NO_TABS.includes(path) && !path.startsWith('/ob-') && !path.startsWith('/invite');
  const body = scroll ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.main, style]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
  ) : (
    <View style={[styles.main, styles.mainFill, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar compact={compactBar} />
      {body}
      {showTabs ? <TabBar active={tabs ?? tabFor(path)} /> : null}
    </SafeAreaView>
  );
}

export function TopBar({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  return (
    <View style={[styles.appbar, compact && { justifyContent: 'flex-end' }]}>
      {compact ? null : (
        <View style={styles.wordmarkRow}>
          <BrandMark size={28} />
          <Text style={styles.wordmark}>renvi</Text>
        </View>
      )}
      <View style={styles.barActions}>
        <LangButton />
        {compact ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.safetyCenter')} onPress={() => router.push('/safety')} style={styles.iconBtn} hitSlop={6}>
            <UiIcon name="shield" size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function LangButton() {
  const { lang, t } = useLang();
  return <IconButton label={t('common.chooseLanguage')} onPress={() => router.push('/language')} text={lang} />;
}

export function IconButton({ label, onPress, text }: { label: string; onPress: () => void; text: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconBtn} hitSlop={6}>
      <Text style={styles.iconBtnText}>{text}</Text>
    </Pressable>
  );
}

const TABS: { href: string; labelKey: TranslationKey; key: 'discover' | 'likes' | 'chats' | 'me'; icon: IconName }[] = [
  { href: '/discover', labelKey: 'tabs.discover', key: 'discover', icon: 'discover' },
  { href: '/likes', labelKey: 'tabs.likes', key: 'likes', icon: 'spark' },
  { href: '/chats', labelKey: 'tabs.chats', key: 'chats', icon: 'chat' },
  { href: '/me', labelKey: 'tabs.me', key: 'me', icon: 'profile' },
];

// Number of new incoming sparks for the tab badge (visible on every plan; the list itself is plan-gated).
function useIncomingCount() {
  const { session } = useSession();
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    if (session) api.incoming().then((r) => alive && setN(r.count), () => {});
    return () => { alive = false; };
  }, [session]);
  return session ? n : 0;
}

export function TabBar({ active }: { active?: string }) {
  const { t } = useLang();
  const incoming = useIncomingCount();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const on = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => router.navigate(tab.href as never)}
            style={styles.tab}
          >
            <View style={styles.tabIcon}><UiIcon name={tab.icon} size={22} color={on ? colors.red : colors.tabInactive} /></View>
            <Text style={[styles.tabLabel, on && { color: colors.red, fontWeight: '700' }]}>{t(tab.labelKey)}</Text>
            {tab.key === 'likes' && incoming > 0 ? <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{incoming}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- typography ----------
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.eyebrow, style as never]}>{children}</Text>;
}
export function Title({ kicker, heading, sub }: { kicker?: string; heading: string; sub?: string }) {
  return (
    <View>
      {kicker ? <Eyebrow>{kicker}</Eyebrow> : null}
      <Text style={styles.h1} accessibilityRole="header">{heading}</Text>
      {sub ? <Text style={styles.lede}>{sub}</Text> : null}
    </View>
  );
}
export const Tiny = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
  <Text style={[styles.tiny, center && { textAlign: 'center' }]}>{children}</Text>
);
export const Lede = ({ children }: { children: React.ReactNode }) => <Text style={styles.lede}>{children}</Text>;
export const Bold = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

// ---------- buttons ----------
type BtnKind = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'warn';
export function Btn({ label, onPress, kind = 'primary', disabled, busy, accessibilityLabel }: {
  label: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; busy?: boolean; accessibilityLabel?: string;
}) {
  const bg = {
    primary: { backgroundColor: colors.red },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.ink },
    tertiary: { backgroundColor: '#efede7' },
    ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
    warn: { backgroundColor: '#f8e7e4', borderWidth: 1, borderColor: '#e7b9b4' },
  }[kind];
  const fg = {
    primary: '#fff', secondary: colors.ink, tertiary: colors.ink, ghost: colors.sub, warn: '#a42623',
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, bg, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}
export function LinkBtn({ label, onPress, center, icon }: { label: string; onPress: () => void; center?: boolean; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.linkBtn, center && { alignSelf: 'stretch' }]} hitSlop={8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: center ? 'center' : 'flex-start', minWidth: 0 }}>
        <Text style={[styles.linkBtnText, center && { textAlign: 'center' }]}>{label}</Text>
        {icon ? <UiIcon name={icon} size={16} color={colors.redDark} /> : null}
      </View>
    </Pressable>
  );
}

// ---------- surfaces ----------
export function Card({ children, tight, style }: { children: React.ReactNode; tight?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, tight && { padding: 13 }, style]}>{children}</View>;
}
export function Line() {
  return <View style={styles.line} />;
}
export function Chip({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'red' | 'green' | 'amber' }) {
  const t = {
    plain: { bg: colors.white, border: colors.line, fg: '#625f59' },
    red: { bg: colors.redWash, border: colors.chipBorder, fg: colors.redDark },
    green: { bg: colors.greenWash, border: '#d2e9d8', fg: colors.green },
    amber: { bg: colors.amberWash, border: '#ecddba', fg: colors.amber },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}
export function Choice({ children, selected, onPress, disabled }: {
  children: React.ReactNode; selected?: boolean; onPress?: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      {children}
    </Pressable>
  );
}
// Native-looking checkbox from the prototype (accent-color: Signal red).
export function Check({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <View aria-hidden style={[styles.check, on && !disabled && styles.checkOn, disabled && { opacity: 0.4 }]}>
      {on && !disabled ? <Text style={styles.checkMark}>✓</Text> : null}
    </View>
  );
}
// Row with a checkbox: label.choice in the prototype (white, no selected tint).
export function CheckRow({ on, onPress, disabled, children, left }: { on: boolean; onPress: () => void; disabled?: boolean; children: React.ReactNode; left?: boolean }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={[styles.choice, left && { justifyContent: 'flex-start', gap: 9 }]}>
      {left ? <Check on={on} disabled={disabled} /> : null}
      <View style={{ flex: left ? 1 : undefined, flexShrink: 1 }}>{children}</View>
      {left ? null : <Check on={on} disabled={disabled} />}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View>
      {label ? <Eyebrow style={{ marginTop: 10, marginBottom: 4 }}>{label}</Eyebrow> : null}
      <TextInput
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor="#aaa"
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}
export function SafeBanner({ children }: { children: React.ReactNode }) {
  return <View style={styles.safeBanner}><Text style={styles.safeBannerText}>{children}</Text></View>;
}
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <StateBlock icon="↻" title={t('common.loadFailed')} copy={message} label={onRetry ? t('common.retry') : undefined} onPress={onRetry} />
  );
}
export function Loading({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.red} />
      <Tiny center>{label ?? t('common.loading')}</Tiny>
    </View>
  );
}
export function StateBlock({ icon, title, copy, label, onPress, secondary }: {
  icon: string; title: string; copy: string; label?: string; onPress?: () => void; secondary?: React.ReactNode;
}) {
  const { t } = useLang();
  return (
    <View style={styles.stateBlock}>
      <Text style={styles.stateIcon}>{icon}</Text>
      <Eyebrow>{t('common.statusEyebrow')}</Eyebrow>
      <Text style={styles.stateTitle} accessibilityRole="header">{title}</Text>
      <Lede>{copy}</Lede>
      {label && onPress ? <View style={{ alignSelf: 'stretch' }}><Btn label={label} onPress={onPress} /></View> : null}
      {secondary}
    </View>
  );
}
export function BackLink({ label, onPress }: { label?: string; onPress?: () => void }) {
  const { t } = useLang();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onPress ?? (() => router.back())} style={styles.back} hitSlop={8}>
      <Text style={styles.backText}>{label ?? t('common.backLink')}</Text>
    </Pressable>
  );
}
export function Meter({ value }: { value: number }) {
  return <View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>;
}
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { t } = useLang();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('common.close')}>
        <Pressable style={styles.sheet} onPress={() => {}}>
        <SafeAreaView edges={['bottom']} style={{ flexShrink: 1 }}>
          <View style={styles.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ flexShrink: 1 }}>
            {children}
          </ScrollView>
          <Btn kind="ghost" label={t('common.close')} onPress={onClose} />
        </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------- profile building blocks ----------
export function PromptCard({ question, answer, onReply }: { question: string; answer: string; onReply?: () => void }) {
  const { t } = useLang();
  return (
    <View style={styles.promptCard}>
      <Eyebrow>{t('components.ui.otvetVAnkete')}</Eyebrow>
      <Text style={styles.promptQ}>{question}</Text>
      <Text style={styles.promptA}>{answer}</Text>
      {onReply ? (
        <Pressable accessibilityRole="button" onPress={onReply} style={styles.promptReact}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><UiIcon name="comment" size={13} /><Text style={styles.promptReactText}>{t('components.ui.otvetit')}</Text></View>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({ uri, size = 49 }: { uri?: string | null; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.blush }} />
  );
}

export function ActionSet({ onPass, onComment, onSpark, onProfile, sparkDisabled }: {
  onPass: () => void; onComment: () => void; onSpark: (completed: () => void) => void; onProfile?: () => void; sparkDisabled?: boolean;
}) {
  const { t } = useLang();
  return (
    <View style={styles.actionSet}>
      <ActionBtn label={t('components.ui.propustit')} icon="close" size={21} onPress={onPass} />
      <ActionBtn label={t('components.ui.sSoobscheniem')} icon="comment" size={22} onPress={onComment} />
      <SparkButton onComplete={onSpark} disabled={sparkDisabled} />
      {onProfile ? <ActionBtn label={t('components.ui.profil')} icon="arrow" size={21} onPress={onProfile} /> : null}
    </View>
  );
}
export function ActionBtn({ label, icon, size = 21, onPress }: { label: string; icon: IconName; size?: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <View style={styles.actionRound}><UiIcon name={icon} size={size} color="#46443f" /></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// Hold to send a spark: ~460 ms; ring fills while held (prototype behaviour).
export function SparkButton({ onComplete, disabled }: { onComplete: (completed: () => void) => void; disabled?: boolean }) {
  const { t } = useLang();
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const fired = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    return () => { if (raf.current) clearInterval(raf.current); };
  }, []);
  const HOLD = 460;
  const start = () => {
    if (disabled) return;
    fired.current = false;
    started.current = Date.now();
    raf.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - started.current) / HOLD);
      setProgress(p);
      if (p >= 1 && !fired.current) {
        fired.current = true;
        if (raf.current) clearInterval(raf.current);
        setProgress(0);
        onComplete(() => {});
      }
    }, 16);
  };
  const end = () => {
    if (raf.current) clearInterval(raf.current);
    if (!fired.current) setProgress(0);
  };
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('components.ui.uderzhatIskru')}
      accessibilityHint={t('components.ui.uderzhivayteChtobyOtpravit')}
      onPressIn={start}
      onPressOut={end}
      onPress={() => { /* hold only; tap explains the gesture */ }}
      disabled={disabled}
      style={[styles.action, disabled && { opacity: 0.5 }]}
    >
      <View style={styles.sparkRing}>
        <Svg width={61} height={61} style={StyleSheet.absoluteFill}>
          <Circle cx={30.5} cy={30.5} r={r} stroke="#f3d7d1" strokeWidth={4} fill="none" />
          <Circle
            cx={30.5} cy={30.5} r={r} stroke={colors.red} strokeWidth={4} fill="none"
            strokeDasharray={`${c * progress} ${c}`} transform="rotate(-90 30.5 30.5)"
          />
        </Svg>
        <View style={styles.sparkInner}><BrandMark color="#fff" size={27} /></View>
      </View>
      <Text style={styles.actionLabel}>{reduceMotion ? t('components.ui.uderzhatIskru') : t('components.ui.uderzhatIskru')}</Text>
    </Pressable>
  );
}

// Full-width primary button that fires only after a ~0.45 s hold ("Удерживать для взаимной искры").
export function HoldButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const { t } = useLang();
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fired = useRef(false);
  const toast = useToast();
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const start = () => {
    fired.current = false;
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 460);
      setProgress(p);
      if (p >= 1 && !fired.current) { fired.current = true; if (timer.current) clearInterval(timer.current); setProgress(0); onComplete(); }
    }, 16);
  };
  const end = () => {
    if (timer.current) clearInterval(timer.current);
    if (!fired.current) { setProgress(0); toast(t('components.ui.uderzhivaytePokaNeZapolnit')); }
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('components.ui.uderzhivayteChtobyOtpravit')} onPressIn={start} onPressOut={end} style={[styles.btn, { backgroundColor: colors.red, overflow: 'hidden' }]}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, backgroundColor: colors.redDark }} />
      <Text style={[styles.btnText, { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, onPress, active }: { label: string; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={[styles.pillBtn, active && styles.pillBtnOn]}>
      <Text style={[styles.pillBtnText, active && { color: colors.redDark }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented({ items, value, onChange }: { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {items.map((i) => (
        <Pressable key={i.key} accessibilityRole="tab" accessibilityState={{ selected: value === i.key }} onPress={() => onChange(i.key)} style={[styles.segBtn, value === i.key && styles.segBtnOn]}>
          <Text style={[styles.segText, value === i.key && { color: colors.ink, fontWeight: '700' }]}>{i.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}
export function Between({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  main: { paddingHorizontal: 18, paddingTop: 5, paddingBottom: 23 },
  mainFill: { flex: 1 },
  appbar: { height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontSize: 29, fontWeight: '900', letterSpacing: -2.2, color: colors.ink },
  barActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 11, fontWeight: '800', color: colors.ink },
  tabs: { height: 76, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingBottom: 10 },
  tab: { width: '24%', height: 52, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabIcon: { height: 23, alignItems: 'center', justifyContent: 'center' },
  tabBadge: { position: 'absolute', right: 16, top: 6, backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
  tabBadgeText: { color: '#fff', fontSize: 8 },
  tabLabel: { fontSize: 9, color: colors.tabInactive, fontWeight: '600' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.eyebrow, textTransform: 'uppercase', marginBottom: 6 },
  h1: { fontSize: 34, fontWeight: '800', lineHeight: 35, letterSpacing: -1.9, color: colors.ink, marginTop: 6, marginBottom: 12 },
  lede: { fontSize: 13, lineHeight: 20, color: colors.sub, marginBottom: 15 },
  tiny: { fontSize: 10, lineHeight: 15, color: colors.muted },
  bold: { fontSize: 13, fontWeight: '700', color: colors.ink },
  btn: { minHeight: 49, borderRadius: 25, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  btnText: { textAlign: 'center', flexShrink: 1, fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  linkBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', maxWidth: '100%', paddingVertical: 7, alignSelf: 'flex-start' },
  linkBtnText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: colors.redDark },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 15, marginVertical: 10 },
  line: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  pill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, marginRight: 7, marginBottom: 7 },
  pillText: { fontSize: 10, lineHeight: 12 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 11, marginVertical: 6, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: { flexShrink: 0, width: 13, height: 13, borderRadius: 3, borderWidth: 1, borderColor: '#767676', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.red, borderColor: colors.red },
  checkMark: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },
  choiceSelected: { borderColor: colors.red, backgroundColor: colors.redWash },
  input: { width: '100%', paddingHorizontal: 13, paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: '#e4e0d8', backgroundColor: colors.white, color: colors.ink, fontSize: 13, minHeight: 45, marginBottom: 9 },
  safeBanner: { backgroundColor: colors.safeBanner, borderWidth: 1, borderColor: colors.safeBannerBorder, borderRadius: 15, padding: 12, marginVertical: 10 },
  safeBannerText: { fontSize: 11, lineHeight: 16, color: colors.safeBannerText },
  loading: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  stateBlock: { alignItems: 'center', paddingVertical: 35, paddingHorizontal: 16 },
  stateIcon: { fontSize: 44, color: colors.red, marginBottom: 16 },
  stateTitle: { fontSize: 31, fontWeight: '800', lineHeight: 33, letterSpacing: -1.5, color: colors.ink, textAlign: 'center', marginBottom: 10 },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 7 },
  backText: { fontSize: 12, fontWeight: '700', color: colors.redDark },
  meter: { height: 5, borderRadius: 9, backgroundColor: '#ece9e2', overflow: 'hidden', marginVertical: 8 },
  meterFill: { height: 5, borderRadius: 8, backgroundColor: colors.red },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 14, paddingBottom: 14, maxHeight: '82%' },
  grabber: { width: 38, height: 4, borderRadius: 4, backgroundColor: '#d3d0c9', alignSelf: 'center', marginBottom: 17 },
  toast: { position: 'absolute', top: 57, left: 16, right: 16, backgroundColor: '#20201e', borderRadius: 13, padding: 12, zIndex: 20 },
  toastText: { color: '#fff', fontSize: 12, textAlign: 'center' },
  promptCard: { backgroundColor: colors.blush, borderRadius: 17, padding: 18, paddingBottom: 49, marginVertical: 10, position: 'relative' },
  promptQ: { fontSize: 22, fontWeight: '800', lineHeight: 24, letterSpacing: -0.9, color: colors.ink, maxWidth: '94%' },
  promptA: { fontSize: 14, lineHeight: 21, color: '#47443f', marginTop: 12 },
  promptReact: { minHeight: 44, justifyContent: 'center', position: 'absolute', right: 12, bottom: 11, backgroundColor: colors.paper, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  promptReactText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  actionSet: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingVertical: 12 },
  action: { alignItems: 'center', gap: 7, minWidth: 56 },
  actionRound: { width: 47, height: 47, borderRadius: 24, backgroundColor: '#EDE9E3', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 9, color: colors.ink, fontWeight: '600' },
  sparkRing: { width: 61, height: 61, alignItems: 'center', justifyContent: 'center' },
  sparkInner: { width: 45, height: 45, borderRadius: 23, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  pillBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', maxWidth: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7, marginRight: 7, marginBottom: 7, backgroundColor: colors.white },
  pillBtnOn: { backgroundColor: colors.redWash, borderColor: colors.chipBorder },
  pillBtnText: { fontSize: 11, color: '#625f59' },
  segmented: { backgroundColor: '#eeece6', padding: 4, borderRadius: 12, flexDirection: 'row', gap: 3, marginVertical: 8 },
  segBtn: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.white },
  segText: { textAlign: 'center', flexShrink: 1, fontSize: 11, color: '#777' },
});
