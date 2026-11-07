import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from './BrandMark';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { localeOf } from '@/i18n/current';
import type { TranslationKey } from '@/i18n';

// Web admin shell: a sidebar on desktop widths, a compact menu on a phone. One list drives both.
type NavItem = [href: string, label: TranslationKey];
const NAV_GROUPS: { title: TranslationKey; items: NavItem[] }[] = [
  {
    title: 'adm.navGroup.moderation',
    items: [['/admin', 'adm.nav.dashboard'], ['/admin/reports', 'adm.nav.reports'], ['/admin/appeals', 'adm.nav.appeals'],
      ['/admin/verification', 'adm.nav.verification'], ['/admin/users', 'adm.nav.users']],
  },
  { title: 'adm.navGroup.insight', items: [['/admin/analytics', 'adm.nav.analytics']] },
  {
    title: 'adm.navGroup.system',
    items: [['/admin/config', 'adm.nav.config'], ['/admin/audit', 'adm.nav.audit'], ['/admin/errors', 'adm.nav.errors'],
      ['/admin/admins', 'adm.nav.admins'], ['/admin/demo', 'adm.nav.demo'], ['/admin/ads', 'adm.nav.ads']],
  },
];
const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const STATUS_TONE = { active: 'green', suspended: 'amber', banned: 'red' } as const;
export const STATUS_LABEL: Record<'active' | 'suspended' | 'banned', TranslationKey> = { active: 'adm.status.active', suspended: 'adm.status.suspended', banned: 'adm.status.banned' };
export const VERIF_LABEL: Record<'none' | 'pending' | 'approved' | 'rejected', TranslationKey> = { none: 'adm.verif.none', pending: 'adm.verif.pending', approved: 'adm.verif.approved', rejected: 'adm.verif.rejected' };
export const REASON_LABEL: Record<string, TranslationKey> = {
  fake: 'adm.reason.fake', photos: 'adm.reason.photos', harassment: 'adm.reason.harassment', scam: 'adm.reason.scam',
  underage: 'adm.reason.underage', illegal: 'adm.reason.illegal', other: 'adm.reason.other',
};
export const OUTCOME_LABEL: Record<string, TranslationKey> = {
  dismissed: 'adm.outcome.dismissed', actioned: 'adm.outcome.actioned', warning: 'adm.outcome.warning', suspension: 'adm.outcome.suspension', ban: 'adm.outcome.ban',
};
export const APPEAL_LABEL: Record<string, TranslationKey> = { open: 'adm.appealStatus.open', accepted: 'adm.appealStatus.accepted', rejected: 'adm.appealStatus.rejected' };

export const useWide = () => useWindowDimensions().width >= 960;

const isActive = (path: string, href: string) =>
  href === '/admin' ? path === '/admin' || path === '/admin/index'
    : path === href || path.startsWith(href + '/') || (href === '/admin/users' && path.startsWith('/admin/user/'));

export function AdminPage({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { t } = useLang();
  const path = usePathname();
  const wide = useWide();
  const [menu, setMenu] = useState(false);
  const header = (
    <View style={[s.pageHead, wide && { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }]}>
      <View style={{ flexShrink: 1 }}>
        <Text style={[s.h1, !wide && { fontSize: 28 }]} accessibilityRole="header">{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: wide ? 0 : 8 }}>{right}</View> : null}
    </View>
  );
  if (wide) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, flexDirection: 'row' }}>
        <ScrollView style={s.side} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}><BrandMark size={24} /><Text style={s.word}>renvi · admin</Text></View>
          {NAV_GROUPS.map((g) => (
            <View key={g.title} style={{ marginBottom: 10 }}>
              <Text style={s.navGroup}>{t(g.title)}</Text>
              {g.items.map(([href, label]) => {
                const on = isActive(path, href);
                return (
                  <Pressable key={href} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => router.replace(href as never)} style={[s.sideItem, on && s.sideItemOn]}>
                    <Text style={[s.sideText, on && { color: colors.paper }]}>{t(label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={{ marginTop: 8, minHeight: 36, justifyContent: 'center' }}><Text style={s.link}>{t('adm.nav.toApp')}</Text></Pressable>
        </ScrollView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.body, { paddingHorizontal: 32 }]}>
          <View style={{ width: '100%', maxWidth: 1400, alignSelf: 'center' }}>
            {header}
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  const current = NAV.find(([href]) => isActive(path, href));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={s.bar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}><BrandMark size={24} /><Text style={s.word}>admin</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('adm.nav.menu')}: ${current ? t(current[1]) : ''}`} accessibilityState={{ expanded: menu }}
          onPress={() => setMenu(!menu)} style={s.menuBtn}>
          <Text style={s.menuText} numberOfLines={1}>{current ? t(current[1]) : t('adm.nav.menu')}</Text>
          <Text style={s.menuText}>{menu ? '▴' : '▾'}</Text>
        </Pressable>
      </View>
      {menu ? (
        <View style={s.menu}>
          {NAV_GROUPS.map((g) => (
            <View key={g.title} style={{ marginBottom: 6 }}>
              <Text style={s.navGroup}>{t(g.title)}</Text>
              {g.items.map(([href, label]) => {
                const on = isActive(path, href);
                return (
                  <Pressable key={href} accessibilityRole="link" accessibilityState={{ selected: on }}
                    onPress={() => { setMenu(false); router.replace(href as never); }} style={[s.menuItem, on && s.sideItemOn]}>
                    <Text style={[s.sideText, on && { color: colors.paper }]}>{t(label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={s.menuItem}><Text style={s.link}>{t('adm.nav.toApp')}</Text></Pressable>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {header}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Table. Desktop: a horizontally scrollable grid with column widths. Phone: three columns or fewer stay a grid that
// fills the screen; wider tables become cards (first cell is the title, the rest are "label: value" lines, a column
// with an empty heading is the action row), so nothing is clipped and nothing needs sideways scrolling.
export function Tbl({ head, rows, widths, empty }: { head: string[]; rows: React.ReactNode[][]; widths?: number[]; empty?: string }) {
  const { t } = useLang();
  const wide = useWide();
  const emptyText = empty ?? t('adm.common.empty');
  const cellNode = (c: React.ReactNode) => (typeof c === 'string' || typeof c === 'number' ? <Text style={s.cell} selectable>{c}</Text> : c);
  if (!wide && head.length > 3) {
    return (
      <View style={{ gap: 10 }}>
        {rows.length === 0 ? <Text style={[s.cell, { paddingVertical: 14, color: colors.sub }]}>{emptyText}</Text> : null}
        {rows.map((r, i) => (
          <View key={i} style={s.rowCard}>
            <View style={{ marginBottom: 4 }}>{typeof r[0] === 'string' || typeof r[0] === 'number' ? <Text style={s.rowCardTitle} selectable>{r[0]}</Text> : r[0]}</View>
            {r.slice(1).map((c, j) => {
              const label = head[j + 1];
              return label ? (
                <View key={j} style={s.kv}><Text style={s.kvK}>{label}</Text><View style={{ flex: 1, minWidth: 0 }}>{cellNode(c)}</View></View>
              ) : <View key={j} style={{ paddingTop: 6 }}>{cellNode(c)}</View>;
            })}
          </View>
        ))}
      </View>
    );
  }
  const col = (j: number) => (wide ? { width: widths?.[j] ?? 160 } : { flex: 1, minWidth: 0 });
  const grid = (
    <View style={wide ? undefined : { alignSelf: 'stretch' }}>
      <View style={[s.tr, { borderTopWidth: 0 }]}>{head.map((h, j) => <Text key={`${h}-${j}`} style={[s.td, s.th, col(j)]}>{h}</Text>)}</View>
      {rows.length === 0 ? <Text style={[s.cell, { paddingVertical: 14, color: colors.sub }]}>{emptyText}</Text> : null}
      {rows.map((r, i) => (
        <View key={i} style={s.tr}>
          {r.map((c, j) => <View key={j} style={[s.td, col(j)]}>{cellNode(c)}</View>)}
        </View>
      ))}
    </View>
  );
  return wide ? <ScrollView horizontal>{grid}</ScrollView> : grid;
}

type Tone = 'ink' | 'red' | 'green' | 'ghost' | 'amber';
export function Act({ label, onPress, tone = 'ink', disabled }: { label: string; onPress: () => void; tone?: Tone; disabled?: boolean }) {
  const bg = tone === 'red' ? colors.red : tone === 'green' ? colors.green : tone === 'amber' ? colors.amber : tone === 'ghost' ? 'transparent' : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={[s.act, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, tone === 'ghost' && { borderWidth: 1, borderColor: colors.ink }]}>
      <Text style={[s.actText, tone === 'ghost' && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}
export function Acts({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

// Ignores a second press while an async action is still running (double click, Enter held down).
export function useLock() {
  const [busy, setBusy] = useState(false);
  const ref = useRef(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (ref.current) return;
    ref.current = true; setBusy(true);
    try { await fn(); } finally { ref.current = false; setBusy(false); }
  }, []);
  return [busy, run] as const;
}

export function Badge({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'red' | 'green' | 'amber' | 'ink' }) {
  const map = {
    plain: [colors.surfaceMuted, colors.ink], red: [colors.redWash, colors.redDark], green: [colors.greenWash, colors.green],
    amber: [colors.amberWash, colors.amber], ink: [colors.ink, colors.paper],
  } as const;
  const [bg, fg] = map[tone];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{label}</Text></View>;
}

// A number with a caption; a link when it has an `href`. Red when something is waiting for a moderator.
export function Stat({ value, label, href, alert }: { value: number | string; label: string; href?: string; alert?: boolean }) {
  return (
    <Pressable accessibilityRole={href ? 'link' : undefined} disabled={!href} onPress={href ? () => router.push(href as never) : undefined}
      style={{ minWidth: 140, flexGrow: 1, flexBasis: 140, borderTopWidth: 2, borderTopColor: alert ? colors.red : colors.ink, paddingVertical: 10, minHeight: 44 }}>
      <Text style={{ fontSize: 34, fontWeight: '900', letterSpacing: -1.5, color: alert ? colors.red : colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 12, color: href ? colors.ink : colors.sub }}>{label}</Text>
    </Pressable>
  );
}

export function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.section, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number' ? <Text style={s.kvV} selectable>{v}</Text> : <View style={{ flex: 1, minWidth: 0 }}>{v}</View>}
    </View>
  );
}

// Two (or more) columns on desktop, stacked on a phone.
export function Columns({ children, min = 360 }: { children: React.ReactNode; min?: number }) {
  const wide = useWide();
  return <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
    {React.Children.map(children, (c) => (c ? <View style={wide ? { flex: 1, minWidth: min } : { width: '100%' }}>{c}</View> : null))}
  </View>;
}

export function Chip({ label, on, onPress, role = 'button' }: { label: string; on: boolean; onPress: () => void; role?: 'button' | 'checkbox' }) {
  return (
    <Pressable accessibilityRole={role} accessibilityState={role === 'checkbox' ? { checked: on } : { selected: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

export function FilterGroup<K extends string>({ label, options, value, onChange }: {
  label: string; options: { key: K | null; label: string }[]; value: K | null; onChange: (k: K | null) => void;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.filterLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => <Chip key={o.key ?? '__all'} label={o.label} on={o.key === value} onPress={() => onChange(o.key)} />)}
      </View>
    </View>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false}
    accessibilityLabel={placeholder} style={s.search} />;
}

export function Pager({ total, offset, limit, onChange }: { total: number; offset: number; limit: number; onChange: (offset: number) => void }) {
  const { t } = useLang();
  if (total <= limit && offset === 0) return <Text style={s.pagerText}>{t('adm.pager.total', { total })}</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10, flexWrap: 'wrap' }}>
      <Act label={t('adm.pager.prev')} tone="ghost" disabled={offset === 0} onPress={() => onChange(Math.max(0, offset - limit))} />
      <Text style={s.pagerText}>{t('adm.pager.range', { from: total === 0 ? 0 : offset + 1, to: Math.min(total, offset + limit), total })}</Text>
      <Act label={t('adm.pager.next')} tone="ghost" disabled={offset + limit >= total} onPress={() => onChange(offset + limit)} />
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <View style={s.errorBox} accessibilityRole="alert">
      <Text style={s.errorText}>{t('adm.common.error', { message })}</Text>
      {onRetry ? <Act label={t('adm.common.retry')} tone="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function Banner({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'green'; children: React.ReactNode }) {
  const bg = tone === 'red' ? colors.redWash : tone === 'green' ? colors.greenWash : colors.amberWash;
  const fg = tone === 'red' ? colors.redDark : tone === 'green' ? colors.green : colors.amber;
  return <View style={[s.banner, { backgroundColor: bg, borderColor: fg }]} accessibilityRole="alert">{typeof children === 'string' ? <Text style={{ color: fg, fontWeight: '700', fontSize: 13 }}>{children}</Text> : children}</View>;
}

// Private media through a short-lived signed URL (admins may read every file, see can_read_media()).
export function AdminPhoto({ path, w = 120, h = 150, label }: { path?: string | null; w?: number; h?: number; label?: string }) {
  const url = useSignedUrl(path ?? null);
  return (
    <View style={{ width: w }}>
      {url ? <Image source={{ uri: url }} style={{ width: w, height: h, borderRadius: 10, backgroundColor: colors.surfaceMuted }} resizeMode="cover" accessibilityLabel={label} />
        : <View style={{ width: w, height: h, borderRadius: 10, backgroundColor: colors.surfaceMuted }} />}
      {label ? <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{label}</Text> : null}
    </View>
  );
}

export function Busy() {
  return <View style={{ paddingVertical: 24 }}><ActivityIndicator color={colors.red} /></View>;
}

export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  if (iso === 'infinity') return '∞';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (d.getFullYear() > 9000) return '∞';
  return d.toLocaleString(localeOf(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};
// 3725 -> "1 ч 02 мин", 125 -> "2 мин 05 с", 40 -> "40 с".
export const fmtDuration = (seconds: number | null | undefined) => {
  const n = Math.round(Number(seconds) || 0);
  if (n >= 3600) return `${Math.floor(n / 3600)} ч ${String(Math.floor((n % 3600) / 60)).padStart(2, '0')} мин`;
  if (n >= 60) return `${Math.floor(n / 60)} мин ${String(n % 60).padStart(2, '0')} с`;
  return `${n} с`;
};
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- Confirmation dialog with a reason (and optional number of days) ----------
export type DialogSpec = {
  title: string;
  body?: string;
  confirmLabel: string;
  tone?: 'ink' | 'red' | 'green';
  reason?: 'required' | 'optional';
  reasonLabel?: string;
  days?: number;               // shows a "days" input with this default
  extra?: { label: string; value: boolean };  // optional checkbox (e.g. "also remove the message")
  presets?: string[];          // quick reason templates
  onConfirm: (input: { reason: string; days: number; extra: boolean }) => Promise<unknown>;
  onDone?: () => void;
};

export function useActionDialog(): [React.ReactNode, (spec: DialogSpec) => void] {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const open = useCallback((d: DialogSpec) => setSpec(d), []);
  const node = spec ? <ActionDialog key={spec.title} spec={spec} onClose={() => setSpec(null)} /> : null;
  return [node, open];
}

function ActionDialog({ spec, onClose }: { spec: DialogSpec; onClose: () => void }) {
  const { t } = useLang();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(String(spec.days ?? ''));
  const [extra, setExtra] = useState(spec.extra?.value ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const need = spec.reason ?? 'required';
  const submit = async () => {
    if (locked.current) return;
    if (need === 'required' && reason.trim().length < 3) { setError(t('adm.dialog.reasonRequired')); return; }
    const n = Number(days);
    if (spec.days !== undefined && (!Number.isInteger(n) || n < 1 || n > 365)) { setError(t('adm.dialog.daysInvalid')); return; }
    locked.current = true; setBusy(true); setError(null);
    try {
      await spec.onConfirm({ reason: reason.trim(), days: n, extra });
      onClose();
      spec.onDone?.();
    } catch (e) {
      setError(t('adm.common.error', { message: errText(e) }));
      locked.current = false; setBusy(false);
    }
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <SafeAreaView style={s.scrim}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 520, maxHeight: '100%' }}>
        <ScrollView style={s.dialog} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" accessibilityViewIsModal>
          <Text style={s.dialogTitle} accessibilityRole="header">{spec.title}</Text>
          {spec.body ? <Text style={s.dialogBody}>{spec.body}</Text> : null}
          {spec.days !== undefined ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={s.filterLabel}>{t('adm.dialog.days')}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {[1, 3, 7, 14, 30].map((d) => <Chip key={d} label={String(d)} on={days === String(d)} onPress={() => setDays(String(d))} />)}
                <TextInput value={days} onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={[s.search, { width: 80, marginBottom: 0 }]} accessibilityLabel={t('adm.dialog.days')} />
              </View>
            </View>
          ) : null}
          <View>
            <Text style={s.filterLabel}>{spec.reasonLabel ?? (need === 'required' ? t('adm.dialog.reason') : t('adm.dialog.reasonOptional'))}</Text>
            {spec.presets?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {spec.presets.map((p) => <Chip key={p} label={p} on={false} onPress={() => setReason(p)} />)}
              </View>
            ) : null}
            <TextInput value={reason} onChangeText={setReason} multiline maxLength={1000} style={[s.search, { minHeight: 80, textAlignVertical: 'top' }]}
              accessibilityLabel={spec.reasonLabel ?? (need === 'required' ? t('adm.dialog.reason') : t('adm.dialog.reasonOptional'))} />
          </View>
          {spec.extra ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: extra }} onPress={() => setExtra(!extra)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 10 }}>
              <View style={[s.box, extra && { backgroundColor: colors.ink }]}>{extra ? <Text style={{ color: colors.paper, fontSize: 11 }}>✓</Text> : null}</View>
              <Text style={{ flex: 1, fontSize: 13, color: colors.ink }}>{spec.extra.label}</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={[s.errorText, { marginBottom: 10 }]} accessibilityRole="alert">{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Act label={t('adm.dialog.cancel')} tone="ghost" onPress={onClose} disabled={busy} />
            <Act label={busy ? t('adm.dialog.working') : spec.confirmLabel} tone={spec.tone ?? 'ink'} onPress={submit} disabled={busy} />
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  word: { fontSize: 20, fontWeight: '900', letterSpacing: -1, color: colors.ink },
  link: { fontSize: 12, fontWeight: '700', color: colors.redDark },
  menuBtn: { minHeight: 44, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.ink, borderRadius: 22, paddingHorizontal: 14 },
  menuText: { fontSize: 13, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  menu: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white },
  menuItem: { minHeight: 44, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 12 },
  navGroup: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.eyebrow, marginTop: 6, marginBottom: 4, paddingHorizontal: 12 },
  side: { width: 220, flexGrow: 0, borderRightWidth: 1, borderRightColor: colors.line },
  sideItem: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 2 },
  sideItemOn: { backgroundColor: colors.ink },
  sideText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  body: { padding: 16, paddingBottom: 60 },
  pageHead: { marginBottom: 16 },
  h1: { fontSize: 34, fontWeight: '800', letterSpacing: -1.5, color: colors.ink },
  sub: { fontSize: 13, color: colors.sub, marginTop: 4 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line },
  td: { paddingVertical: 10, paddingRight: 12 },
  th: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.eyebrow },
  cell: { fontSize: 12, color: colors.ink },
  rowCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 },
  rowCardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  act: { minHeight: 44, minWidth: 44, justifyContent: 'center', maxWidth: '100%', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, alignSelf: 'flex-start' },
  actText: { textAlign: 'center', flexShrink: 1, color: '#fff', fontSize: 11, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  section: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  kv: { flexDirection: 'row', gap: 10, paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.line },
  kvK: { width: '42%', maxWidth: 150, flexShrink: 1, fontSize: 12, color: colors.sub },
  kvV: { flex: 1, minWidth: 0, fontSize: 12, color: colors.ink },
  filterLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.eyebrow, marginBottom: 5 },
  chip: { minHeight: 44, justifyContent: 'center', maxWidth: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, color: colors.ink, fontWeight: '600' },
  search: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.ink, backgroundColor: colors.white, marginBottom: 10 },
  pagerText: { fontSize: 12, color: colors.sub, marginVertical: 8 },
  errorBox: { borderWidth: 1, borderColor: colors.red, backgroundColor: colors.redWash, borderRadius: 10, padding: 12, marginBottom: 12, gap: 8 },
  errorText: { color: colors.redDark, fontSize: 13, fontWeight: '600' },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 520, backgroundColor: colors.paper, borderRadius: 16 },
  dialogTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  dialogBody: { fontSize: 13, color: colors.sub, marginBottom: 12 },
  box: { width: 18, height: 18, borderWidth: 1, borderColor: colors.ink, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
