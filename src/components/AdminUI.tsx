import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from './BrandMark';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { localeOf } from '@/i18n/current';
import type { TranslationKey } from '@/i18n';

// Web admin shell: sidebar on desktop widths, horizontal tabs on a phone.
const NAV: [string, TranslationKey][] = [
  ['/admin', 'adm.nav.dashboard'], ['/admin/reports', 'adm.nav.reports'], ['/admin/appeals', 'adm.nav.appeals'],
  ['/admin/verification', 'adm.nav.verification'], ['/admin/users', 'adm.nav.users'], ['/admin/config', 'adm.nav.config'],
  ['/admin/referrals', 'adm.nav.referrals'], ['/admin/audit', 'adm.nav.audit'], ['/admin/admins', 'adm.nav.admins'],
  ['/admin/errors', 'adm.nav.errors'],
];

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

export const useWide = () => useWindowDimensions().width >= 960;

const isActive = (path: string, href: string) =>
  href === '/admin' ? path === '/admin' || path === '/admin/index'
    : path === href || path.startsWith(href + '/') || (href === '/admin/users' && path.startsWith('/admin/user/'));

export function AdminPage({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { t } = useLang();
  const path = usePathname();
  const wide = useWide();
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
        <View style={s.side}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}><BrandMark size={24} /><Text style={s.word}>renvi · admin</Text></View>
          {NAV.map(([href, label]) => {
            const on = isActive(path, href);
            return (
              <Pressable key={href} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => router.replace(href as never)} style={[s.sideItem, on && s.sideItemOn]}>
                <Text style={[s.sideText, on && { color: colors.paper }]}>{t(label)}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.replace('/')} style={{ marginTop: 18 }}><Text style={s.link}>{t('adm.nav.toApp')}</Text></Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.body, { paddingHorizontal: 32 }]}>
          <View style={{ width: '100%', maxWidth: 1400, alignSelf: 'center' }}>
            {header}
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={s.bar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><BrandMark size={24} /><Text style={s.word}>renvi · admin</Text></View>
        <Pressable onPress={() => router.replace('/')}><Text style={s.link}>{t('adm.nav.toApp')}</Text></Pressable>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.nav}>
          {NAV.map(([href, label]) => {
            const on = isActive(path, href);
            return (
              <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.replace(href as never)} style={[s.tab, on && s.tabOn]}>
                <Text style={[s.tabText, on && { color: colors.paper }]}>{t(label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {header}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Table: horizontal scroll on narrow screens; optional fixed column widths and an empty-state line.
export function Tbl({ head, rows, widths, empty }: { head: string[]; rows: React.ReactNode[][]; widths?: number[]; empty?: string }) {
  const { t } = useLang();
  const w = (j: number) => ({ width: widths?.[j] ?? 160 });
  return (
    <ScrollView horizontal>
      <View>
        <View style={[s.tr, { borderTopWidth: 0 }]}>{head.map((h, j) => <Text key={`${h}-${j}`} style={[s.td, s.th, w(j)]}>{h}</Text>)}</View>
        {rows.length === 0 ? <Text style={[s.cell, { paddingVertical: 14, color: colors.sub }]}>{empty ?? t('adm.common.empty')}</Text> : null}
        {rows.map((r, i) => (
          <View key={i} style={s.tr}>
            {r.map((c, j) => <View key={j} style={[s.td, w(j)]}>{typeof c === 'string' || typeof c === 'number' ? <Text style={s.cell} selectable>{c}</Text> : c}</View>)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
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

export function Badge({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'red' | 'green' | 'amber' | 'ink' }) {
  const map = {
    plain: [colors.surfaceMuted, colors.ink], red: [colors.redWash, colors.redDark], green: [colors.greenWash, colors.green],
    amber: [colors.amberWash, colors.amber], ink: [colors.ink, colors.paper],
  } as const;
  const [bg, fg] = map[tone];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{label}</Text></View>;
}

export function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.section, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <Text style={s.sectionTitle}>{title}</Text>
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
      {typeof v === 'string' || typeof v === 'number' ? <Text style={s.kvV} selectable>{v}</Text> : <View style={{ flex: 1 }}>{v}</View>}
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

export function FilterGroup<K extends string>({ label, options, value, onChange }: {
  label: string; options: { key: K | null; label: string }[]; value: K | null; onChange: (k: K | null) => void;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.filterLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable key={o.key ?? '__all'} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipText, on && { color: colors.paper }]}>{o.label}</Text>
            </Pressable>
          );
        })}
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
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- Confirmation dialog with a reason (and optional number of days) ----------
export type DialogSpec = {
  title: string;
  body?: string;
  confirmLabel: string;
  tone?: 'ink' | 'red' | 'green';
  reason?: 'required' | 'optional' | 'none';
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
  const need = spec.reason ?? 'required';
  const submit = async () => {
    if (need === 'required' && reason.trim().length < 3) { setError(t('adm.dialog.reasonRequired')); return; }
    const n = Number(days);
    if (spec.days !== undefined && (!Number.isInteger(n) || n < 1 || n > 365)) { setError(t('adm.dialog.daysInvalid')); return; }
    setBusy(true); setError(null);
    try {
      await spec.onConfirm({ reason: reason.trim(), days: n, extra });
      onClose();
      spec.onDone?.();
    } catch (e) {
      setError(t('adm.common.error', { message: errText(e) }));
    } finally { setBusy(false); }
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.dialog} accessibilityViewIsModal>
          <Text style={s.dialogTitle} accessibilityRole="header">{spec.title}</Text>
          {spec.body ? <Text style={s.dialogBody}>{spec.body}</Text> : null}
          {spec.days !== undefined ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={s.filterLabel}>{t('adm.dialog.days')}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {[1, 3, 7, 14, 30].map((d) => (
                  <Pressable key={d} onPress={() => setDays(String(d))} style={[s.chip, days === String(d) && s.chipOn]}>
                    <Text style={[s.chipText, days === String(d) && { color: colors.paper }]}>{d}</Text>
                  </Pressable>
                ))}
                <TextInput value={days} onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={[s.search, { width: 80, marginBottom: 0 }]} accessibilityLabel={t('adm.dialog.days')} />
              </View>
            </View>
          ) : null}
          {need !== 'none' ? (
            <View>
              <Text style={s.filterLabel}>{spec.reasonLabel ?? (need === 'required' ? t('adm.dialog.reason') : t('adm.dialog.reasonOptional'))}</Text>
              {spec.presets?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {spec.presets.map((p) => <Pressable key={p} onPress={() => setReason(p)} style={s.chip}><Text style={s.chipText}>{p}</Text></Pressable>)}
                </View>
              ) : null}
              <TextInput value={reason} onChangeText={setReason} multiline maxLength={1000} style={[s.search, { minHeight: 80, textAlignVertical: 'top' }]}
                accessibilityLabel={spec.reasonLabel ?? t('adm.dialog.reason')} />
            </View>
          ) : null}
          {spec.extra ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: extra }} onPress={() => setExtra(!extra)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={[s.box, extra && { backgroundColor: colors.ink }]}>{extra ? <Text style={{ color: colors.paper, fontSize: 11 }}>✓</Text> : null}</View>
              <Text style={{ fontSize: 13, color: colors.ink }}>{spec.extra.label}</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={[s.errorText, { marginBottom: 10 }]} accessibilityRole="alert">{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Act label={t('adm.dialog.cancel')} tone="ghost" onPress={onClose} disabled={busy} />
            <Act label={busy ? t('adm.dialog.working') : spec.confirmLabel} tone={spec.tone ?? 'ink'} onPress={submit} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  word: { fontSize: 20, fontWeight: '900', letterSpacing: -1, color: colors.ink },
  link: { fontSize: 12, fontWeight: '700', color: colors.redDark },
  nav: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  tab: { borderWidth: 1, borderColor: colors.ink, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  side: { width: 220, borderRightWidth: 1, borderRightColor: colors.line, paddingHorizontal: 14, paddingVertical: 20 },
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
  act: { borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, alignSelf: 'flex-start' },
  actText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  section: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  kv: { flexDirection: 'row', gap: 10, paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.line },
  kvK: { width: 150, fontSize: 12, color: colors.sub },
  kvV: { flex: 1, fontSize: 12, color: colors.ink },
  filterLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.eyebrow, marginBottom: 5 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, color: colors.ink, fontWeight: '600' },
  search: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.ink, backgroundColor: colors.white, marginBottom: 10 },
  pagerText: { fontSize: 12, color: colors.sub, marginVertical: 8 },
  errorBox: { borderWidth: 1, borderColor: colors.red, backgroundColor: colors.redWash, borderRadius: 10, padding: 12, marginBottom: 12, gap: 8 },
  errorText: { color: colors.redDark, fontSize: 13, fontWeight: '600' },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 520, backgroundColor: colors.paper, borderRadius: 16, padding: 18 },
  dialogTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  dialogBody: { fontSize: 13, color: colors.sub, marginBottom: 12 },
  box: { width: 18, height: 18, borderWidth: 1, borderColor: colors.ink, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
