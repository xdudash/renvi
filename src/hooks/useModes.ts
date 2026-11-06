import { api, type Modes } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';

/** The signed-in person's statuses and visibility modes (server decides whether dating is open). */
export function useModes() {
  const r = useAsync<Modes>(() => api.myModes(), []);
  return { modes: r.data, loading: r.loading, error: r.error, reload: r.reload };
}
