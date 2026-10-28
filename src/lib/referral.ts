import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEY = 'renvi.invite';
export async function rememberInvite(code: string) { await AsyncStorage.setItem(KEY, code.toUpperCase()); }
export async function pendingInvite(): Promise<string | null> {
  try { return await AsyncStorage.getItem(KEY); } catch { return null; }
}
export async function lookupInvite(code: string): Promise<{ name: string | null } | null> {
  const { data, error } = await supabase.rpc('referral_lookup', { p_code: code });
  if (error) throw error;
  return (data as { name: string | null } | null) ?? null;
}
export async function myReferral(): Promise<{ code: string; verified: number; goal: number }> {
  const { data, error } = await supabase.rpc('my_referral');
  if (error) throw error;
  return data as { code: string; verified: number; goal: number };
}
export const inviteUrl = (code: string) =>
  `${process.env.EXPO_PUBLIC_APP_URL ?? 'https://renvi.app'}/invite/${code}`;
