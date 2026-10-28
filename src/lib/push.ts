import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

// Asks for permission and links this device's push token to the account. Push texts never contain names or messages.
export async function enablePush(): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const cur = await Notifications.getPermissionsAsync();
  const perm = cur.granted ? cur : await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api.registerPush(token, Platform.OS === 'ios' ? 'ios' : 'android');
    return 'ok';
  } catch {
    return 'error';
  }
}
