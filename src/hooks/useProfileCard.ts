import { api, type DiscoverCard } from '@/lib/api';
import { useDiscover } from '@/lib/discover';
import { useAsync } from './useAsync';

export type FullCard = DiscoverCard & { bio?: string; music_url?: string | null };

// Uses the card already loaded in discovery when possible; otherwise asks the server (same visibility rules).
export function useProfileCard(id?: string | null) {
  const d = useDiscover();
  const local = d.cards.find((c) => c.profile_id === id) ?? null;
  return useAsync<FullCard | null>(async () => {
    if (!id) return null;
    const full = await api.profileCard(id);
    return (full as FullCard | null) ?? (local as FullCard | null);
  }, [id]);
}
