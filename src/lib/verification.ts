import * as ImagePicker from 'expo-image-picker';
import { api } from './api';
import { supabase } from './supabase';

// Takes a selfie with the camera, stores it privately and opens a moderation request.
export async function startSelfieVerification(uid: string): Promise<'ok' | 'denied' | 'cancel' | 'error'> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return 'denied';
  const res = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.8 });
  if (res.canceled || !res.assets[0]) return 'cancel';
  try {
    const path = await api.uploadPhoto(uid, res.assets[0].uri, res.assets[0].mimeType ?? 'image/jpeg', 'verify');
    const { error } = await supabase.rpc('request_verification', { p_path: path });
    if (error) throw error;
    return 'ok';
  } catch {
    return 'error';
  }
}
