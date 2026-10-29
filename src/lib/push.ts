import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { supabase } from './supabase';

const TOKEN_KEY = 'renvi.pushToken';

async function deviceToken(): Promise<string> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
}

// Asks for permission and links this device's push token to the account. Push texts never contain names or messages.
export async function enablePush(): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const cur = await Notifications.getPermissionsAsync();
  const perm = cur.granted ? cur : await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  try {
    const token = await deviceToken();
    await api.registerPush(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * Removes this device's push token from `uid` (RLS policy push_own allows a user to delete their own rows), so the
 * device stops receiving that account's notifications. Must run while the user is still signed in. Returns false on failure.
 */
export async function unlinkPush(uid: string): Promise<boolean> {
  try {
    let token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
    // Registered by an older build that did not remember the token: ask the OS (only when notifications are allowed).
    if (!token && Platform.OS !== 'web' && Device.isDevice && (await Notifications.getPermissionsAsync()).granted) token = await deviceToken();
    if (!token) return true;
    const { error } = await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', uid);
    if (error) return false;
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
