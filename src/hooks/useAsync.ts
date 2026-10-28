import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, toAppError } from '@/lib/errors';
import { logError } from '@/lib/errorLog';

type State<T> = { key: string; tick: number; data: T | null; error: AppError | null; done: boolean };

// Data loading: loading / error / data with a retry. `deps` must be primitives (ids, flags).
export function useAsync<T>(fn: () => Promise<T>, deps: readonly (string | number | boolean | null | undefined)[] = []) {
  const key = JSON.stringify(deps);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>({ key: '', tick: -1, data: null, error: null, done: false });

  useEffect(() => {
    let alive = true;
    fnRef.current().then(
      (data) => { if (alive) setState({ key, tick, data, error: null, done: true }); },
      (e) => {
        const err = e instanceof AppError ? e : toAppError(e);
        if (err.kind === 'server') logError('load', String((e as Error)?.message ?? err.message));
        if (alive) setState((s) => ({ key, tick, data: s.key === key ? s.data : null, error: err, done: true }));
      },
    );
    return () => { alive = false; };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((d: T | null) => setState((s) => ({ ...s, data: d })), []);
  const fresh = state.key === key && state.tick === tick && state.done;
  return {
    data: state.key === key ? state.data : null,
    error: fresh ? state.error : null,
    loading: !fresh && !(state.key === key && state.data !== null),
    reload,
    setData,
  };
}
