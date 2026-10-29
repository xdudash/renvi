import { useAsync } from './useAsync';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

export type MyPrompt = { id?: string; question_key: string; answer: string; position: number };

// Own prompt answers (up to 3). Saving replaces the full set in ONE transaction (save_prompts, migration 0030):
// the old delete-then-insert lost every answer when the insert failed. A failed load is an error, not "no answers"
// (saving over an empty list would wipe them).
export function useMyPrompts() {
  const { session } = useSession();
  const uid = session?.user.id;
  const q = useAsync<MyPrompt[]>(async () => {
    if (!uid) return [];
    const { data, error } = await supabase.from('profile_prompts').select('id, question_key, answer, position').eq('profile_id', uid).order('position');
    if (error) throw error;
    return (data ?? []) as MyPrompt[];
  }, [uid]);
  const items = q.data ?? [];
  const load = async () => { q.reload(); };
  const saveAll = async (next: MyPrompt[]) => {
    if (!uid) throw new Error('not signed in');
    const clean = next.filter((p) => p.answer.trim().length > 0).slice(0, 3);
    const { error } = await supabase.rpc('save_prompts', {
      p_items: clean.map((p) => ({ question_key: p.question_key, answer: p.answer.trim() })),
    });
    if (error) throw error;
    await load();
  };
  return { items, saveAll, reload: load, loading: q.loading, error: q.error };
}
