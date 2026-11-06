import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Btn, Eyebrow, Field, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { PlanPoll } from '@/lib/plans';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

const MAX_OPTIONS = 6;

/** Polls of one plan: tap an option to vote (change anytime until it is closed); the host or the author closes it. */
export function PlanPolls({ planId, isHost, version }: { planId: string; isHost: boolean; version: number }) {
  const { t } = useLang();
  const toast = useToast();
  const [polls, setPolls] = useState<PlanPoll[]>([]);
  const load = useCallback(() => { api.planPolls(planId).then(setPolls, () => {}); }, [planId]);
  // Light polling keeps the counts fresh while the chat is open; new messages (version) refresh them too.
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load, version]);

  const vote = async (poll: PlanPoll, option: string) => {
    if (poll.closed || poll.my_option === option) return;
    setPolls((l) => l.map((x) => (x.id === poll.id ? { ...x, my_option: option } : x)));
    try { await api.planPollVote(poll.id, option); } catch { toast(t('plans.poll.fail')); }
    load();
  };
  const close = async (poll: PlanPoll) => {
    try { await api.planPollClose(poll.id); } catch { toast(t('plans.poll.fail')); }
    load();
  };
  if (!polls.length) return null;
  return (
    <View style={s.wrap}>
      {polls.map((p) => {
        const total = p.options.reduce((n, o) => n + o.votes, 0);
        return (
          <View key={p.id} style={[s.card, p.closed && { opacity: 0.75 }]}>
            <Eyebrow>{t('plans.poll.by', { name: p.author ?? '' })}</Eyebrow>
            <Text style={s.q}>{p.question}</Text>
            {p.options.map((o) => {
              const pct = total ? Math.round((o.votes / total) * 100) : 0;
              const on = p.my_option === o.id;
              return (
                <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: on, disabled: p.closed }} disabled={p.closed} onPress={() => vote(p, o.id)} style={[s.opt, on && s.optOn]}>
                  <View style={[s.bar, { width: `${pct}%` }]} />
                  <Text style={s.label}>{on ? '✓ ' : ''}{o.label}</Text>
                  <Text style={s.count}>{o.votes}</Text>
                </Pressable>
              );
            })}
            <View style={s.foot}>
              <Text style={s.meta}>{p.closed ? t('plans.poll.closed') : t('plans.poll.votes', { n: total })}</Text>
              {!p.closed && (p.mine || isHost) ? (
                <Pressable accessibilityRole="button" onPress={() => close(p)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.closeText}>{t('plans.poll.close')}</Text></Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** The «new poll» form that replaces the composer while it is open. */
export function PollComposer({ planId, onDone }: { planId: string; onDone: (created: boolean) => void }) {
  const { t } = useLang();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const clean = opts.map((o) => o.trim()).filter(Boolean);
  const ok = q.trim().length >= 3 && clean.length >= 2;
  const create = async () => {
    if (!ok) { toast(t('plans.poll.rule')); return; }
    setBusy(true);
    try { await api.planPollCreate(planId, q.trim(), clean); onDone(true); }
    catch (e: any) { toast(e?.code === 'P0006' ? t('plans.poll.tooMany') : t('plans.poll.fail')); }
    finally { setBusy(false); }
  };
  return (
    <View style={s.composer}>
      <Eyebrow>{t('plans.poll.new')}</Eyebrow>
      <Field label={t('plans.poll.q')} value={q} onChangeText={setQ} maxLength={120} placeholder={t('plans.poll.qPh')} />
      {opts.map((o, i) => (
        <Field key={i} value={o} maxLength={60} placeholder={t('plans.poll.opt', { n: i + 1 })} onChangeText={(v) => setOpts((l) => l.map((x, j) => (j === i ? v : x)))} />
      ))}
      {opts.length < MAX_OPTIONS ? <Btn kind="ghost" label={t('plans.poll.add')} onPress={() => setOpts((l) => [...l, ''])} /> : null}
      <Btn label={t('plans.poll.create')} onPress={create} busy={busy} disabled={!ok} />
      <Btn kind="ghost" label={t('plans.poll.cancel')} onPress={() => onDone(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12, gap: 6 },
  q: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 2 },
  opt: { minHeight: 44, borderWidth: 1.5, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  optOn: { borderColor: colors.ink },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.blush, opacity: 0.55 },
  label: { flex: 1, fontSize: 13, color: colors.ink, fontWeight: '600' },
  count: { fontSize: 12, fontWeight: '800', color: colors.ink, marginLeft: 8 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: 10.5, color: colors.sub },
  closeText: { fontSize: 11.5, fontWeight: '700', color: colors.redDark },
  composer: { paddingHorizontal: 17, paddingVertical: 8, gap: 6, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
