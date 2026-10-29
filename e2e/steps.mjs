// Shared step runner for the e2e scripts. A failing step is recorded and the remaining independent steps keep
// running (unless `stopOnFail`), but finish() always exits non-zero when any step failed.
export function createRunner({ label = 'e2e', onFail, diagnose, stopOnFail = false } = {}) {
  const passed = [];
  const failed = [];
  let stopped = false;
  async function step(name, fn) {
    if (stopped) {
      console.log('SKIP', name, '(an earlier required step failed)');
      failed.push({ name, message: 'skipped: an earlier required step failed' });
      return false;
    }
    try {
      await fn();
      passed.push(name);
      console.log('ok', name);
      return true;
    } catch (e) {
      const message = String(e?.message ?? e).split('\n')[0];
      // Optional page context (URL, JS errors, visible text) so a failure is diagnosable from the annotation alone.
      let diag = '';
      try { diag = (await diagnose?.()) ?? ''; } catch { /* diagnostics must never hide the failure */ }
      failed.push({ name, message });
      console.log('FAIL', name, message);
      // In GitHub Actions, surface each real failure as an annotation (visible on the PR page and via the API).
      if (diag) console.log('  context:', diag);
      if (process.env.GITHUB_ACTIONS) console.log(`::error title=E2E ${label}::${name}: ${message} ${diag ? '| ' + diag : ''}`.replace(/[\r\n%]/g, ' ').slice(0, 1800));
      if (stopOnFail) stopped = true;
      try { await onFail?.(name, e); } catch { /* artifact capture must never hide the failure */ }
      return false;
    }
  }
  function summary() {
    const lines = [`\n== ${label}: ${passed.length} passed, ${failed.length} failed ==`];
    for (const n of passed) lines.push('  PASS ' + n);
    for (const f of failed) lines.push('  FAIL ' + f.name + ' - ' + f.message);
    return lines.join('\n');
  }
  // Prints the summary, runs cleanup (e.g. closing the browser), then exits 1 if any step failed.
  async function finish(cleanup) {
    console.log(summary());
    const skipped = failed.filter((f) => f.message.startsWith('skipped:')).length;
    if (process.env.GITHUB_ACTIONS && failed.length) console.log(`::notice title=E2E ${label}::${passed.length} passed, ${failed.length - skipped} failed, ${skipped} skipped after a required failure`);
    try { await cleanup?.(); } catch (e) { console.log('cleanup error:', e?.message); }
    process.exit(failed.length ? 1 : 0);
  }
  return { step, summary, finish, passed, failed };
}
