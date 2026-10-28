import { useState } from 'react';
import { useAsync } from './useAsync';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { logError } from '@/lib/errorLog';

export type MyMedia = { id: string; kind: 'photo' | 'video'; storage_path: string; position: number; url?: string };

// Own profile media: list with signed URLs, add from the system picker, remove.
export function useMyPhotos() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [busy, setBusy] = useState(false);
  const q = useAsync<MyMedia[]>(async () => {
    if (!uid) return [];
    const rows = (await api.myPhotos(uid)) as MyMedia[];
    return Promise.all(rows.map(async (r) => ({ ...r, url: await api.signedUrl(r.storage_path).catch(() => undefined) })));
  }, [uid]);
  const items = q.data ?? [];
  const load = async () => { q.reload(); };

  const add = async (): Promise<'ok' | 'denied' | 'cancel' | 'full' | 'error'> => {
    if (!uid) return 'error';
    if (items.length >= 6) return 'full';
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'denied';
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], quality: 0.85, allowsEditing: false, videoMaxDuration: 15,
    });
    if (res.canceled || !res.assets[0]) return 'cancel';
    const a = res.assets[0];
    if (a.type === 'video' && ((a.duration ?? 0) > 15000 || (a.fileSize ?? 0) > 30 * 1024 * 1024)) return 'error';
    setBusy(true);
    try {
      const path = await api.uploadPhoto(uid, a.uri, a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'));
      const { error } = await supabase.from('profile_photos').insert({
        profile_id: uid, storage_path: path, kind: a.type === 'video' ? 'video' : 'photo', position: items.length,
      });
      if (error) throw error;
      await load();
      return 'ok';
    } catch {
      return 'error';
    } finally {
      setBusy(false);
    }
  };
  // Each write is checked: an error, or an RLS-filtered write that touched no row, counts as a failure.
  const setPosition = async (id: string, position: number): Promise<boolean> => {
    const { data, error } = await supabase.from('profile_photos').update({ position }).eq('id', id).select('id');
    return !error && (data?.length ?? 0) === 1;
  };
  // The Storage file is deleted only after the row delete succeeded; returns 'error' when the photo is still there.
  const remove = async (id: string): Promise<'ok' | 'error'> => {
    const row = items.find((i) => i.id === id);
    const { data, error } = await supabase.from('profile_photos').delete().eq('id', id).select('id');
    if (error || (data?.length ?? 0) === 0) { await load(); return 'error'; }
    if (row) {
      const { error: fileErr } = await supabase.storage.from('profile-media').remove([row.storage_path]);
      if (fileErr) logError('photos', `storage remove failed: ${fileErr.message}`); // the profile no longer references it
    }
    await load();
    return 'ok';
  };
  const move = async (id: string, dir: -1 | 1): Promise<'ok' | 'error'> => {
    const idx = items.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return 'ok';
    const a = items[idx], b = items[j];
    const first = await setPosition(a.id, b.position);
    const second = first && (await setPosition(b.id, a.position));
    await load();
    return first && second ? 'ok' : 'error';
  };
  const makeCover = async (id: string): Promise<'ok' | 'error'> => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx <= 0) return 'ok';
    const ordered = [items[idx], ...items.filter((_, j) => j !== idx)];
    const results = await Promise.all(ordered.map((it, pos) => setPosition(it.id, pos)));
    await load();
    return results.every(Boolean) ? 'ok' : 'error';
  };
  return { items, add, remove, move, makeCover, busy, reload: load };
}
