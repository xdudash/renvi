import { useAsync } from './useAsync';
import { api } from '@/lib/api';
import { placeLabel } from '@/lib/catalog';
import { dayLong } from '@/lib/dateDraft';
import { useLang } from '@/lib/lang';

export function useDateRow(id?: string) {
  const { t } = useLang();
  const r = useAsync(() => (id ? api.getDate(id) : Promise.resolve(null)), [id]);
  const d = r.data;
  return {
    ...r,
    place: d ? placeLabel(d.place_key, d.place_custom, t) : '',
    day: d ? dayLong(d.day) : '',
    time: d ? d.starts_at.slice(0, 5) : '',
  };
}
