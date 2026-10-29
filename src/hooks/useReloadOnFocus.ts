import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// Stack screens stay mounted underneath the screens pushed on top of them. Lists loaded once on mount (chats,
// archive, profile summary, the open conversation's context) were stale when the user came back with
// router.back() / router.navigate(): unread counts, archived chats, photo counts, photo consent, the date card.
// Runs `onRefocus` each time the screen becomes focused again (not on the first focus: mount already loads).
export function useReloadOnFocus(onRefocus: () => void) {
  const fn = useRef(onRefocus);
  useEffect(() => { fn.current = onRefocus; });
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    fn.current();
  }, []));
}
