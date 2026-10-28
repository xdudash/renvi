import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Eyebrow, useToast } from './ui';
import { colors } from '@/theme/tokens';
import { api } from '@/lib/api';
import { ONBOARDING, type OnbRoute } from '@/lib/onboarding';
import { useSession } from '@/lib/session';

export function OnbHeader({ step, kicker, heading, sub }: { step: number; kicker: string; heading: string; sub: string }) {
  return (
    <View>
      <View style={s.between}>
        <Eyebrow>{kicker}</Eyebrow>
        <Text style={s.stepnum}>{step + 1} / 12</Text>
      </View>
      <View style={s.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 12, now: step + 1 }}>
        <View style={[s.progressFill, { width: `${Math.round(((step + 1) / 12) * 100)}%` }]} />
      </View>
      <Text style={s.h1} accessibilityRole="header">{heading}</Text>
      <Text style={s.lede}>{sub}</Text>
    </View>
  );
}

// Saves the patch for this step and the progress pointer, then moves on. Progress survives app restarts.
export function useStepSave(route: OnbRoute) {
  const toast = useToast();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const idx = ONBOARDING.indexOf(route);
  const save = async (patch: Record<string, unknown>, nextOverride?: string) => {
    setBusy(true);
    try {
      await api.saveOnboarding({ ...patch, onboarding_step: Math.min(idx + 1, ONBOARDING.length - 1) });
      await refresh();
      router.push((nextOverride ?? `/${ONBOARDING[idx + 1]}`) as never);
    } catch (e: any) {
      toast(e?.message === 'must be 18+' ? 'Участникам RENVI должно быть 18 лет или больше.' : 'Не удалось сохранить. Повторите попытку.');
    } finally {
      setBusy(false);
    }
  };
  const saveDraftAndExit = async (patch: Record<string, unknown>) => {
    try { await api.saveOnboarding({ ...patch, onboarding_step: idx }); toast('Черновик анкеты сохранён'); } catch { toast('Не удалось сохранить черновик'); }
    router.replace('/');
  };
  return { save, busy, saveDraftAndExit };
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepnum: { fontSize: 10, color: '#98948c' },
  progress: { height: 4, backgroundColor: '#ebe8e1', borderRadius: 8, marginTop: 6, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.red },
  h1: { fontSize: 34, fontWeight: '800', lineHeight: 35, letterSpacing: -1.9, color: colors.ink, marginTop: 8, marginBottom: 12 },
  lede: { fontSize: 13, lineHeight: 20, color: colors.sub, marginBottom: 15 },
});
