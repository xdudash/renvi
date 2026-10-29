// Pure: one in-flight run per button. `busy` disables a button only after React re-renders, so two taps in the
// same frame (or a fast double tap on iOS) both reached async handlers: two invitations, two appeals, two
// "propose another time" declines. While the promise returned by the handler is pending, further presses are dropped.
export type PressState = { busy: boolean };

/** Runs `fn` unless an earlier run is still pending. Returns whether it ran. */
export function runGuarded(state: PressState, fn: () => unknown): boolean {
  if (state.busy) return false;
  const result = fn();
  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    state.busy = true;
    const done = () => { state.busy = false; };
    (result as PromiseLike<unknown>).then(done, done);
  }
  return true;
}
