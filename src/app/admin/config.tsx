import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AdminPage, Act, Badge, Busy, Columns, ErrorNote, KV, Section, errText, fmtDate } from '@/components/AdminUI';
import { useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { adminApi, isEmail, isHttpsUrl } from '@/lib/adminApi';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';
import type { TranslationKey } from '@/i18n';

type Json = unknown;
type Obj = Record<string, Json>;
const asObj = (v: Json): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const KNOWN = ['daily_spark_limit', 'legal_urls', 'support_email', 'banned_words', 'referral', 'rate_limits', 'digest', 'demo_bots', 'launch_countries', 'countries', 'languages'];
const LEGAL: [string, TranslationKey][] = [
  ['privacy', 'adm.cfg.legalPrivacy'], ['terms', 'adm.cfg.legalTerms'], ['community', 'adm.cfg.legalCommunity'],
  ['moderation', 'adm.cfg.legalModeration'],
];
const WEEKDAYS: TranslationKey[] = ['adm.cfg.wd0', 'adm.cfg.wd1', 'adm.cfg.wd2', 'adm.cfg.wd3', 'adm.cfg.wd4', 'adm.cfg.wd5', 'adm.cfg.wd6'];
const RATE_LABEL: Record<string, TranslationKey> = {
  report: 'adm.cfg.rlReport', submit_appeal: 'adm.cfg.rlAppeal', video_call: 'adm.cfg.rlVideo', video_call_join: 'adm.cfg.rlVideoJoin',
};
const muted = { fontSize: 11, color: colors.sub } as const;
const input = { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: colors.ink, backgroundColor: colors.white } as const;

const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

function Num({ value, onChange, label, width = 90 }: { value: string; onChange: (v: string) => void; label: string; width?: number }) {
  return <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel={label} style={[input, { width }]} />;
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => onChange(!on)}
      style={{ width: 42, height: 24, borderRadius: 12, backgroundColor: on ? colors.green : colors.line, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white }} />
    </Pressable>
  );
}
function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line, flexWrap: 'wrap' }}>
      <View style={{ width: 200 }}><Text style={{ fontSize: 13, color: colors.ink }}>{label}</Text>{hint ? <Text style={muted}>{hint}</Text> : null}</View>
      <View style={{ flex: 1, minWidth: 160 }}>{children}</View>
    </View>
  );
}

// Card with a save button, client-side validation result and the server's answer.
function Editor({ title, k, note, validate, build, children, onSaved }: {
  title: string; k: string | string[]; note?: string; validate: () => string | null; build: () => Record<string, Json>;
  children: ReactNode; onSaved: () => void;
}) {
  const { t } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr(null);
    try {
      for (const [key, value] of Object.entries(build())) await adminApi.setConfig(key, value);
      toast(t('adm.common.saved')); onSaved();
    } catch (e) { setErr(t('adm.common.error', { message: errText(e) })); } finally { setBusy(false); }
  };
  return (
    <Section title={title} right={<Text style={muted}>{Array.isArray(k) ? k.join(' + ') : k}</Text>}>
      {note ? <Text style={[muted, { marginBottom: 8 }]}>{note}</Text> : null}
      {children}
      {err ? <Text style={{ color: colors.redDark, fontSize: 12, marginTop: 8 }} accessibilityRole="alert">{err}</Text> : null}
      <View style={{ marginTop: 10 }}><Act label={busy ? t('adm.dialog.working') : t('adm.cfg.save')} onPress={save} disabled={busy} /></View>
    </Section>
  );
}

function LegalEditor({ cfg, onSaved }: { cfg: Obj; onSaved: () => void }) {
  const { t } = useLang();
  const legal = asObj(cfg.legal_urls);
  const [urls, setUrls] = useState<Record<string, string>>(Object.fromEntries(LEGAL.map(([k]) => [k, typeof legal[k] === 'string' ? (legal[k] as string) : ''])));
  const [email, setEmail] = useState(typeof cfg.support_email === 'string' ? cfg.support_email : '');
  const bad = LEGAL.filter(([k]) => urls[k].trim() && !isHttpsUrl(urls[k]));
  return (
    <Editor title={t('adm.cfg.legalTitle')} k={['legal_urls', 'support_email']} note={t('adm.cfg.legalNote')} onSaved={onSaved}
      validate={() => (bad.length ? t('adm.cfg.badUrl', { field: bad.map(([, l]) => t(l)).join(', ') }) : email.trim() && !isEmail(email) ? t('adm.cfg.badEmail') : null)}
      build={() => ({
        legal_urls: Object.fromEntries(LEGAL.map(([k]) => [k, urls[k].trim() || null])),
        support_email: email.trim() || null,
      })}>
      {LEGAL.map(([k, l]) => {
        const v = urls[k];
        const ok = v.trim() !== '' && isHttpsUrl(v);
        return (
          <Row key={k} label={t(l)} hint={k}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput value={v} onChangeText={(x) => setUrls({ ...urls, [k]: x })} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url"
                accessibilityLabel={t(l)} style={[input, { flex: 1 }, v.trim() && !ok ? { borderColor: colors.red } : null]} />
              <Badge label={ok ? '✓' : v.trim() ? t('adm.cfg.invalid') : t('adm.cfg.empty')} tone={ok ? 'green' : v.trim() ? 'red' : 'amber'} />
            </View>
          </Row>
        );
      })}
      <Row label={t('adm.cfg.supportEmail')} hint="support_email">
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="support@…" autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            accessibilityLabel={t('adm.cfg.supportEmail')} style={[input, { flex: 1 }, email.trim() && !isEmail(email) ? { borderColor: colors.red } : null]} />
          <Badge label={email.trim() && isEmail(email) ? '✓' : email.trim() ? t('adm.cfg.invalid') : t('adm.cfg.empty')} tone={email.trim() && isEmail(email) ? 'green' : email.trim() ? 'red' : 'amber'} />
        </View>
      </Row>
    </Editor>
  );
}

// Anti-abuse daily spark limit: one whole number, the same for every user (RENVI has no paid plans).
function SparkLimitEditor({ cfg, onSaved }: { cfg: Obj; onSaved: () => void }) {
  const { t } = useLang();
  const cur = typeof cfg.daily_spark_limit === 'number' ? cfg.daily_spark_limit : 100;
  const [v, setV] = useState(String(cur));
  return (
    <Editor title={t('adm.cfg.sparkLimitTitle')} k="daily_spark_limit" note={t('adm.cfg.sparkLimitNote')} onSaved={onSaved}
      validate={() => { const n = toInt(v); return Number.isNaN(n) || n < 1 || n > 100000 ? t('adm.cfg.range', { field: 'daily_spark_limit', min: 1, max: 100000 }) : null; }}
      build={() => ({ daily_spark_limit: toInt(v) })}>
      <Row label={t('adm.cfg.sparkLimitLabel')} hint="daily_spark_limit · 1–100000"><Num value={v} label="daily_spark_limit" onChange={setV} /></Row>
    </Editor>
  );
}

function WordsEditor({ cfg, onSaved }: { cfg: Obj; onSaved: () => void }) {
  const { t } = useLang();
  const initial = Array.isArray(cfg.banned_words) ? (cfg.banned_words as string[]) : [];
  const [text, setText] = useState(initial.join('\n'));
  const words = Array.from(new Set(text.split(/[\n,]/).map((w) => w.trim().toLowerCase()).filter(Boolean)));
  const bad = words.filter((w) => w.length < 2 || w.length > 64);
  return (
    <Editor title={t('adm.cfg.wordsTitle')} k="banned_words" note={t('adm.cfg.wordsNote')} onSaved={onSaved}
      validate={() => (bad.length ? t('adm.cfg.badWords', { words: bad.slice(0, 5).join(', ') }) : null)}
      build={() => ({ banned_words: words })}>
      <TextInput value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} accessibilityLabel={t('adm.cfg.wordsTitle')}
        style={[input, { minHeight: 140, textAlignVertical: 'top' }]} />
      <Text style={muted}>{t('adm.cfg.wordsCount', { n: words.length })}</Text>
    </Editor>
  );
}

// Object of whole numbers with labelled fields (referral, demo bots, rate limits).
type NumField = { key: string; label: string; min: number; max: number; hint?: string };
function NumbersEditor({ cfg, k, title, note, fields, onSaved, extraKeys }: {
  cfg: Obj; k: string; title: string; note?: string; fields: NumField[]; onSaved: () => void; extraKeys?: boolean;
}) {
  const { t } = useLang();
  const cur = asObj(cfg[k]);
  const all = extraKeys ? Array.from(new Set([...fields.map((f) => f.key), ...Object.keys(cur)])) : fields.map((f) => f.key);
  const spec = (key: string): NumField => fields.find((f) => f.key === key) ?? { key, label: key, min: 1, max: 100000 };
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(all.map((key) => [key, cur[key] === undefined || cur[key] === null ? '' : String(cur[key])])));
  return (
    <Editor title={title} k={k} note={note} onSaved={onSaved}
      validate={() => {
        for (const key of all) {
          const s = spec(key); const n = toInt(v[key] ?? '');
          if (Number.isNaN(n) || n < s.min || n > s.max) return t('adm.cfg.range', { field: s.label, min: s.min, max: s.max });
        }
        return null;
      }}
      build={() => ({ [k]: { ...cur, ...Object.fromEntries(all.map((key) => [key, toInt(v[key])])) } })}>
      {all.map((key) => {
        const s = spec(key);
        return <Row key={key} label={s.label} hint={`${key} · ${s.min}–${s.max}${s.hint ? ` · ${s.hint}` : ''}`}><Num value={v[key] ?? ''} label={s.label} onChange={(x) => setV({ ...v, [key]: x })} /></Row>;
      })}
    </Editor>
  );
}

function DigestEditor({ cfg, onSaved }: { cfg: Obj; onSaved: () => void }) {
  const { t } = useLang();
  const cur = asObj(cfg.digest);
  const [enabled, setEnabled] = useState(cur.enabled === true);
  const [weekday, setWeekday] = useState(typeof cur.weekday === 'number' ? cur.weekday : 0);
  const [hour, setHour] = useState(String(cur.hour_utc ?? 17));
  return (
    <Editor title={t('adm.cfg.digestTitle')} k="digest" note={t('adm.cfg.digestNote')} onSaved={onSaved}
      validate={() => { const h = toInt(hour); return Number.isNaN(h) || h > 23 ? t('adm.cfg.range', { field: 'hour_utc', min: 0, max: 23 }) : null; }}
      build={() => ({ digest: { ...cur, enabled, weekday, hour_utc: toInt(hour) } })}>
      <Row label={t('adm.cfg.digestEnabled')}><Toggle on={enabled} onChange={setEnabled} label={t('adm.cfg.digestEnabled')} /></Row>
      <Row label={t('adm.cfg.digestDay')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {WEEKDAYS.map((w, i) => (
            <Pressable key={w} onPress={() => setWeekday(i)} style={{ borderWidth: 1, borderColor: weekday === i ? colors.ink : colors.line, backgroundColor: weekday === i ? colors.ink : colors.white, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: weekday === i ? colors.paper : colors.ink }}>{t(w)}</Text>
            </Pressable>
          ))}
        </View>
      </Row>
      <Row label={t('adm.cfg.digestHour')} hint="UTC 0–23"><Num value={hour} onChange={setHour} label={t('adm.cfg.digestHour')} /></Row>
    </Editor>
  );
}

function CountriesEditor({ cfg, onSaved }: { cfg: Obj; onSaved: () => void }) {
  const { t } = useLang();
  const all = Array.isArray(cfg.countries) ? (cfg.countries as string[]) : [];
  const [sel, setSel] = useState<string[]>(Array.isArray(cfg.launch_countries) ? (cfg.launch_countries as string[]) : []);
  return (
    <Editor title={t('adm.cfg.countriesTitle')} k="launch_countries" note={t('adm.cfg.countriesNote')} onSaved={onSaved}
      validate={() => (sel.length === 0 ? t('adm.cfg.countriesEmpty') : null)} build={() => ({ launch_countries: sel })}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {all.map((c) => {
          const on = sel.includes(c);
          return (
            <Pressable key={c} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setSel(on ? sel.filter((x) => x !== c) : [...sel, c])}
              style={{ borderWidth: 1, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.white, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, color: on ? colors.paper : colors.ink, fontWeight: '700' }}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </Editor>
  );
}

// Keys added later by other features (e.g. video / voice): JSON editor, same JSON type enforced by the server.
function JsonEditor({ k, value, onSaved }: { k: string; value: Json; onSaved: () => void }) {
  const { t } = useLang();
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  let parsed: Json = undefined;
  let parseErr: string | null = null;
  try { parsed = JSON.parse(text); } catch { parseErr = t('adm.cfg.badJson'); }
  return (
    <Editor title={k} k={k} note={t('adm.cfg.otherNote')} onSaved={onSaved} validate={() => parseErr} build={() => ({ [k]: parsed })}>
      <TextInput value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} accessibilityLabel={k}
        style={[input, { minHeight: 110, fontFamily: 'Courier', fontSize: 12, textAlignVertical: 'top' }, parseErr ? { borderColor: colors.red } : null]} />
    </Editor>
  );
}

const short = (v: Json) => { const s = JSON.stringify(v); return s && s.length > 160 ? s.slice(0, 157) + '…' : s ?? 'null'; };

export default function AdminConfig() {
  const { t } = useLang();
  const cfg = useAsync(() => adminApi.config(), []);
  const hist = useAsync(() => adminApi.audit({ action: 'config.', limit: 20, offset: 0 }), []);
  const [gen, setGen] = useState(0);
  const saved = () => { cfg.reload(); hist.reload(); setGen((g) => g + 1); };
  const c = cfg.data;
  const rateFields = [
    { key: 'report', label: t('adm.cfg.rlReport'), min: 1, max: 100000 }, { key: 'submit_appeal', label: t('adm.cfg.rlAppeal'), min: 1, max: 100000 },
  ];
  const rateKeys = Object.keys(asObj(c?.rate_limits));
  const others = c ? Object.keys(c).filter((k) => !KNOWN.includes(k)).sort() : [];
  return (
    <AdminPage title={t('adm.cfg.title')} sub={t('adm.cfg.sub')}>
      {cfg.error ? <ErrorNote message={errText(cfg.error)} onRetry={cfg.reload} /> : null}
      {!c ? <Busy /> : (
        <View key={gen}>
          <Columns min={420}>
            <View>
              <LegalEditor cfg={c} onSaved={saved} />
              <SparkLimitEditor cfg={c} onSaved={saved} />
              <CountriesEditor cfg={c} onSaved={saved} />
              <WordsEditor cfg={c} onSaved={saved} />
            </View>
            <View>
              <NumbersEditor cfg={c} k="referral" title={t('adm.cfg.referralTitle')} note={t('adm.cfg.referralNote')} onSaved={saved} fields={[
                { key: 'goal', label: t('adm.cfg.refGoal'), min: 1, max: 1000 }]} />
              <NumbersEditor cfg={c} k="rate_limits" title={t('adm.cfg.rateTitle')} note={t('adm.cfg.rateNote')} onSaved={saved} extraKeys
                fields={[...rateFields, ...rateKeys.filter((k) => !rateFields.some((f) => f.key === k)).map((k) => ({ key: k, label: RATE_LABEL[k] ? t(RATE_LABEL[k]) : k, min: 1, max: 100000 }))]} />
              <DigestEditor cfg={c} onSaved={saved} />
              <NumbersEditor cfg={c} k="demo_bots" title={t('adm.cfg.demoTitle')} note={t('adm.cfg.demoNote')} onSaved={saved} fields={[
                { key: 'match_every', label: t('adm.cfg.demoEvery'), min: 1, max: 100 }, { key: 'welcome_sparks', label: t('adm.cfg.demoWelcome'), min: 0, max: 20 }]} />
              {others.map((k) => <JsonEditor key={k} k={k} value={c[k]} onSaved={saved} />)}
            </View>
          </Columns>
          <Section title={t('adm.cfg.history')}>
            {hist.error ? <ErrorNote message={errText(hist.error)} onRetry={hist.reload} /> : null}
            {(hist.data?.rows ?? []).length === 0 ? <Text style={muted}>{t('adm.common.empty')}</Text> : (hist.data?.rows ?? []).map((h) => (
              <KV key={h.id} k={`${fmtDate(h.created_at)}\n${h.admin_email ?? '—'}`} v={
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.ink }}>{h.target_id}</Text>
                  <Text style={muted} selectable>{t('adm.cfg.was')}: {short((h.details as Obj).old)}</Text>
                  <Text style={{ fontSize: 11, color: colors.ink }} selectable>{t('adm.cfg.now')}: {short((h.details as Obj).new)}</Text>
                </View>
              } />
            ))}
          </Section>
        </View>
      )}
    </AdminPage>
  );
}
