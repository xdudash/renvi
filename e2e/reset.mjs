// Removes ONLY the e2e test accounts (…@renvi.test). Refuses to touch a non-local project unless E2E_ALLOW_RESET=1.
import { SERVICE, URL } from './api.mjs';

const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL);
if (!local && process.env.E2E_ALLOW_RESET !== '1') {
  console.error(`Refusing to delete users on ${URL}. Set E2E_ALLOW_RESET=1 only for a staging project.`);
  process.exit(1);
}
const h = { apikey: SERVICE, authorization: 'Bearer ' + SERVICE };
const list = await (await fetch(URL + '/auth/v1/admin/users?per_page=1000', { headers: h })).json();
for (const u of (list.users ?? []).filter((x) => x.email?.endsWith('@renvi.test'))) {
  const r = await fetch(URL + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: h });
  console.log('deleted', u.email, r.status);
}
