// Side effects are injected so the authorization/reset/audit order is independently testable.
type Account = { id: string; email: string };
export type ResetDependencies = {
  authorize: () => Promise<string | null>;
  eligible: (id: string) => Promise<Account | null>;
  authUser: (id: string) => Promise<Account | null>;
  stillEligible: (id: string) => Promise<boolean>;
  reserve: (actor: string, target: Account) => Promise<number>;
  updatePassword: (id: string, password: string) => Promise<void>;
  finish: (audit: number, status: 'confirmed' | 'unconfirmed' | 'denied') => Promise<void>;
};
type Result = { status: number; error?: string; email?: string; auditPending?: boolean };
export async function resetDemoAccess(body: unknown, deps: ResetDependencies): Promise<Result> {
  const actor = await deps.authorize();
  if (!actor) return { status: 403, error: 'forbidden' };
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const { userId, password } = input;
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)
    || typeof password !== 'string' || [...password].length < 8 || new TextEncoder().encode(password).length > 72) {
    return { status: 400, error: 'invalid_input' };
  }
  const target = await deps.eligible(userId);
  if (!target || target.id !== userId || !/^[^@\s]+@demo\.renvi\.app$/i.test(target.email)) return { status: 403, error: 'ineligible' };
  const current = await deps.authUser(userId);
  if (!current || current.id !== userId || current.email !== target.email || !await deps.stillEligible(userId)) {
    return { status: 403, error: 'ineligible' };
  }
  let audit: number;
  try { audit = await deps.reserve(actor, target); }
  catch { return { status: 503, error: 'audit_unavailable' }; }
  // Audit I/O is a separate round trip: reject identities changed during reservation.
  try {
    const latest = await deps.authUser(userId);
    if (!latest || latest.id !== userId || latest.email !== target.email || !await deps.stillEligible(userId)) {
      try { await deps.finish(audit, 'denied'); } catch { /* reserved audit survives */ }
      return { status: 403, error: 'ineligible' };
    }
  } catch {
    try { await deps.finish(audit, 'denied'); } catch { /* reserved audit survives */ }
    return { status: 503, error: 'service_unavailable' };
  }
  try { await deps.updatePassword(userId, password); }
  catch {
    // A network failure may be ambiguous. Never promise that Auth did not change.
    try { await deps.finish(audit, 'unconfirmed'); } catch { /* reserved audit survives */ }
    return { status: 502, error: 'reset_unconfirmed' };
  }
  let auditPending = false;
  try { await deps.finish(audit, 'confirmed'); } catch { auditPending = true; }
  return { status: 200, email: target.email, auditPending };
}
