import { useState } from 'react';
import { useAsync } from './useAsync';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

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
  const remove = async (id: string) => {
    const row = items.find((i) => i.id === id);
    await supabase.from('profile_photos').delete().eq('id', id);
    if (row) await supabase.storage.from('profile-media').remove([row.storage_path]);
    await load();
  };
  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    await supabase.from('profile_photos').update({ position: b.position }).eq('id', a.id);
    await supabase.from('profile_photos').update({ position: a.position }).eq('id', b.id);
    await load();
  };
  const makeCover = async (id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    const ordered = [items[idx], ...items.filter((_, j) => j !== idx)];
    await Promise.all(ordered.map((it, pos) => supabase.from('profile_photos').update({ position: pos }).eq('id', it.id)));
    await load();
  };
  return { items, add, remove, move, makeCover, busy, reload: load };
}
