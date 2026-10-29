// Browser-only fictitious fixtures; this does not verify backend behavior.
export const fixtureScreenMap = Object.fromEntries([
  'ob-age', 'ob-gender', 'ob-seeking', 'ob-intent', 'ob-city', 'ob-about', 'ob-prompts', 'ob-location',
  'settings', 'privacy-visibility', 'privacy-data', 'plans', 'filters', 'legal',
].map((route) => [route, [`/${route}`, 1]]));
fixtureScreenMap['ob-age-locked'] = ['/ob-age?qa=locked', 1];
fixtureScreenMap['ob-gender-locked'] = ['/ob-gender?qa=locked', 1];
export async function installMobileFixtures(context, app) {
  const id = '00000000-0000-4000-8000-000000000001';
  const profile = { id, name: 'Mobile QA', display_name: 'Mobile QA', birthdate: '1995-06-15', gender: 'woman', seeking: 'men', intent: 'serious', city: 'Bratislava', country: 'SK', language: 'RU', onboarding_done: true, adult_confirmed_at: '2026-01-01T00:00:00Z', terms_accepted_at: '2026-01-01T00:00:00Z', sensitive_consent_at: '2026-01-01T00:00:00Z', interests: ['travel'], bio: 'Fictitious mobile layout fixture', show_active: true };
  const session = { access_token: `e30.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`, refresh_token: 'mobile-layout-fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id, email: 'mobile-layout@renvi.test', email_confirmed_at: '2026-01-01T00:00:00Z', aud: 'authenticated', app_metadata: {}, user_metadata: {} } };
  await context.addInitScript(({ session }) => { localStorage.setItem('sb-127-auth-token', JSON.stringify(session)); localStorage.setItem('renvi.lang', 'RU'); }, { session });
  await context.route('http://127.0.0.1:54321/**', async (route) => {
    const url = new URL(route.request().url());
    const screen = new URL(route.request().frame().url());
    const identity = { birthdate: screen.pathname === '/ob-age' && !screen.searchParams.has('qa') ? null : profile.birthdate, gender: screen.pathname === '/ob-gender' && !screen.searchParams.has('qa') ? null : profile.gender };
    identity.birthdate_locked_at = identity.birthdate ? '2026-01-01T00:00:00Z' : null;
    identity.gender_locked_at = identity.gender ? '2026-01-01T00:00:00Z' : null;
    let value = [];
    if (url.pathname === '/auth/v1/user') value = session.user;
    else if (url.pathname === '/rest/v1/profiles') value = { ...profile, ...identity };
    else if (url.pathname === '/rest/v1/subscriptions') value = null;
    else if (url.pathname === '/rest/v1/rpc/my_identity') value = identity;
    else if (url.pathname === '/rest/v1/rpc/incoming_sparks') value = { count: 0, items: [] };
    else if (url.pathname === '/rest/v1/rpc/my_analytics_consent') value = false;
    else if (url.pathname === '/rest/v1/app_config') value = null;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': new URL(app).origin }, body: JSON.stringify(value) });
  });
}
