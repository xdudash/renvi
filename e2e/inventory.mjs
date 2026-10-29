// Pure rules for the mobile web route inventory (no Playwright import, so node:test can exercise them).
//
// A row is one screen at one viewport. Findings are what a reviewer has to look at: a redirect to an unexpected
// route, a navigation failure, a page exception, visible horizontal overflow and (with strict targets) touch
// targets below 44×44. Redirects that are the screen's documented behaviour are declared in `expectedRedirects`
// (screen-map.mjs) with a reason, so they are verified rather than ignored: the row must land exactly there.

/** The route a row must end up on: its own path, or the declared redirect target. */
export function expectedPath(name, url, expectedRedirects = {}) {
  return expectedRedirects[name]?.to ?? url.split('?')[0];
}

/** Human-readable findings of one captured row (empty = clean). */
export function rowFindings(row, { strictTargets = false } = {}) {
  const out = [];
  if (row.navigationError) out.push(`navigation: ${row.navigationError}`);
  if (row.expected !== row.at) out.push(`redirect: expected ${row.expected}, opened ${row.at || '(nothing)'}`);
  for (const e of row.errors ?? []) out.push(`page error: ${e}`);
  if (row.outside?.length) out.push(`overflow: ${row.outside.length} element(s) outside the viewport`);
  if (strictTargets && row.smallTargets?.length) out.push(`targets: ${row.smallTargets.length} below 44×44`);
  return out;
}

/** Declared redirects must name a target and a reason, and refer to screens that exist in the map. */
export function validateExpectedRedirects(map, expectedRedirects) {
  const problems = [];
  for (const [name, r] of Object.entries(expectedRedirects)) {
    if (!(name in map)) problems.push(`${name}: not in the screen map`);
    if (!r?.to || !r.to.startsWith('/')) problems.push(`${name}: redirect target must be a path`);
    if (!r?.why || r.why.length < 10) problems.push(`${name}: redirect needs a reason`);
    if (name in map && r?.to === map[name][0].split('?')[0]) problems.push(`${name}: target equals its own route`);
  }
  return problems;
}
