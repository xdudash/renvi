// Verifies every key in sk/cs/en/ua exists in ru. Run: node scripts/check-i18n.mjs (Node >= 22.6 type stripping).
const load = async (n) => (await import(new URL(`../src/i18n/${n}.ts`, import.meta.url).href))[n];
const ru = await load('ru');
let bad = 0;
for (const l of ['sk', 'cs', 'en', 'ua']) {
  const d = await load(l);
  for (const [k, v] of Object.entries(d)) {
    if (!(k in ru)) { console.error(`i18n: ${l}.ts has unknown key "${k}"`); bad++; }
    if (typeof v !== 'string') { console.error(`i18n: ${l}.ts "${k}" is not a string`); bad++; }
  }
}
if (bad) process.exit(1);
console.log(`i18n ok (${Object.keys(ru).length} ru keys)`);
