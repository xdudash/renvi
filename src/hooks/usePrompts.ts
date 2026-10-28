import { useAsync } from './useAsync';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

export type MyPrompt = { id?: string; question_key: string; answer: string; position: number };

// Own prompt answers (up to 3). Saving replaces the full set.
export function useMyPrompts() {
  const { session } = useSession();
  const uid = session?.user.id;
  const q = useAsync<MyPrompt[]>(async () => {
    if (!uid) return [];
    const { data } = await supabase.from('profile_prompts').select('id, question_key, answer, position').eq('profile_id', uid).order('position');
    return (data ?? []) as MyPrompt[];
  }, [uid]);
  const items = q.data ?? [];
  const load = async () => { q.reload(); };
  const saveAll = async (next: MyPrompt[]) => {
    if (!uid) throw new Error('not signed in');
    const clean = next.filter((p) => p.answer.trim().length > 0).slice(0, 3);
    const { error: delErr } = await supabase.from('profile_prompts').delete().eq('profile_id', uid);
    if (delErr) throw delErr;
    if (clean.length) {
      const { error } = await supabase.from('profile_prompts').insert(
        clean.map((p, i) => ({ profile_id: uid, question_key: p.question_key, answer: p.answer.trim(), position: i })),
      );
      if (error) throw error;
    }
    await load();
  };
  return { items, saveAll, reload: load };
}
