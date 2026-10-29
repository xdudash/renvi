// App Store release gate (no dependencies). Docs: docs/APP_STORE.md.
//
//   node scripts/check-release.mjs            static checks of app.json / eas.json / assets / source (CI "check" job)
//   node scripts/check-release.mjs --strict   + live checks before `eas build --profile production`:
//                                             backend env, legal URLs and support e-mail in the hosted app_config,
//                                             legal pages reachable, EAS submit ids
//
// --strict reads EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY from the environment or from .env.
// Every failure is printed as "error: …" (scripts/ci-annotate.sh turns those into PR annotations); exit code 1.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const errors = [];
const warnings = [];
let passed = 0;
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const check = (cond, msg) => { if (cond) passed++; else fail(msg); return !!cond; };
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => { try { return JSON.parse(read(p)); } catch (e) { fail(`${p} is not valid JSON: ${e.message}`); return null; } };
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

// The bundle id is permanent once a build is uploaded to App Store Connect. Changing it means a new app record.
// If the founder deliberately picks another id BEFORE the first upload, change it here and in app.json together.
const PINNED_BUNDLE_ID = 'com.renvi.app';

// ---------------------------------------------------------------- app.json
const app = json('app.json')?.expo ?? {};
const ios = app.ios ?? {};
const plist = ios.infoPlist ?? {};
check(nonEmpty(app.name) && app.name.length <= 30, 'error: expo.name must be set (App Store name, max 30 characters)');
check(nonEmpty(app.slug), 'error: expo.slug must be set');
check(/^\d+\.\d+\.\d+$/.test(app.version ?? ''), `error: expo.version must be MAJOR.MINOR.PATCH (got ${JSON.stringify(app.version)})`);
check(!/^0\./.test(app.version ?? ''), `error: expo.version ${app.version} looks pre-release; the first App Store version is 1.0.0`);
check(ios.bundleIdentifier === PINNED_BUNDLE_ID, `error: ios.bundleIdentifier is ${JSON.stringify(ios.bundleIdentifier)}, pinned ${PINNED_BUNDLE_ID} (permanent after the first upload; see docs/APP_STORE.md)`);
check(/^\d+(\.\d+){0,2}$/.test(String(ios.buildNumber ?? '')), 'error: ios.buildNumber must be a numeric string such as "1" (EAS increments the remote value)');
check(ios.supportsTablet === false || ios.supportsTablet === true, 'error: ios.supportsTablet must be set explicitly (false = iPhone only)');
check(app.orientation === 'portrait', 'error: expo.orientation must be "portrait"');
check(['light', 'dark', 'automatic'].includes(app.userInterfaceStyle), 'error: expo.userInterfaceStyle must be set');
const encryption = plist.ITSAppUsesNonExemptEncryption ?? ios.config?.usesNonExemptEncryption;
check(encryption === false, 'error: ITSAppUsesNonExemptEncryption must be false (the app only uses standard HTTPS/TLS)');

// Permission strings: Info.plist keys may come from ios.infoPlist or from config-plugin options.
const PLUGIN_KEYS = {
  'expo-image-picker': { photosPermission: 'NSPhotoLibraryUsageDescription', cameraPermission: 'NSCameraUsageDescription', microphonePermission: 'NSMicrophoneUsageDescription' },
  'expo-location': { locationWhenInUsePermission: 'NSLocationWhenInUseUsageDescription', locationAlwaysAndWhenInUsePermission: 'NSLocationAlwaysAndWhenInUseUsageDescription', locationAlwaysPermission: 'NSLocationAlwaysUsageDescription' },
};
const plugins = new Map((app.plugins ?? []).map((p) => (Array.isArray(p) ? [p[0], p[1] ?? {}] : [p, {}])));
const usage = {}; // Info.plist key -> string (or false = removed)
for (const [k, v] of Object.entries(plist)) if (/^NS\w+UsageDescription$/.test(k)) usage[k] = v;
for (const [plugin, map] of Object.entries(PLUGIN_KEYS)) {
  if (!plugins.has(plugin)) continue;
  const opts = plugins.get(plugin);
  for (const [opt, key] of Object.entries(map)) {
    // A plugin without an explicit option writes its English default ("Allow $(PRODUCT_NAME) to …"): not acceptable.
    if (!(opt in opts)) { fail(`error: ${plugin} option "${opt}" is not set; the plugin would write a generic English ${key}`); continue; }
    usage[key] = opts[opt];
  }
}
for (const [key, text] of Object.entries(usage)) {
  if (text === false) continue;
  check(nonEmpty(text) && text.trim().length >= 20 && !/\$\(PRODUCT_NAME\)|TODO|lorem/i.test(text), `error: ${key} must be a clear, specific purpose string (got ${JSON.stringify(text)})`);
}
check(!('NSUserTrackingUsageDescription' in plist), 'error: NSUserTrackingUsageDescription present, but the app does not track (no ATT prompt)');
check(!plist.UIBackgroundModes, 'error: ios.infoPlist.UIBackgroundModes is set; the app needs no background modes');
check(plugins.get('expo-location')?.isIosBackgroundLocationEnabled !== true, 'error: expo-location background location must stay disabled (distance only, when in use)');
check(plugins.get('expo-notifications')?.enableBackgroundRemoteNotifications !== true, 'error: expo-notifications background remote notifications are not used');
for (const o of ['supportsBackgroundPlayback', 'supportsPictureInPicture']) check(plugins.get('expo-video')?.[o] !== true, `error: expo-video ${o} adds an unused background mode`);

// Every permission the code actually asks for must have its purpose string.
const SRC = listFiles(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
const srcText = new Map(SRC.map((f) => [relative(ROOT, f), readFileSync(f, 'utf8')]));
const anySrc = (re) => [...srcText.values()].some((t) => re.test(t));
const NEEDS = [
  [/launchCameraAsync|requestCameraPermissionsAsync/, 'NSCameraUsageDescription', 'camera (selfie verification)'],
  [/launchImageLibraryAsync|requestMediaLibraryPermissionsAsync/, 'NSPhotoLibraryUsageDescription', 'photo library'],
  [/requestForegroundPermissionsAsync|getCurrentPositionAsync/, 'NSLocationWhenInUseUsageDescription', 'location when in use'],
  [/mediaCapturePermissionGrantType/, 'NSCameraUsageDescription', 'camera (video call WebView)'],
  [/mediaCapturePermissionGrantType/, 'NSMicrophoneUsageDescription', 'microphone (video call WebView)'],
];
for (const [re, key, what] of NEEDS) if (anySrc(re)) check(nonEmpty(usage[key]), `error: the code uses the ${what} but ${key} is missing`);
check(!anySrc(/requestBackgroundPermissionsAsync|startLocationUpdatesAsync/), 'error: background location API used in src/, but only when-in-use location is declared');
check(!anySrc(/requestTrackingPermissionsAsync|expo-tracking-transparency/), 'error: tracking permission requested, but NSPrivacyTracking is false');

// Privacy manifest (ios.privacyManifests -> PrivacyInfo.xcprivacy).
const pm = ios.privacyManifests;
const REASONS = {
  NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1', '1C8F.1', 'C56D.1', 'AC6B.1'],
  NSPrivacyAccessedAPICategoryFileTimestamp: ['DDA9.1', 'C617.1', '3B52.1', '0A2A.1'],
  NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1', '8FFB.1', '3D61.1'],
  NSPrivacyAccessedAPICategoryDiskSpace: ['85F4.1', 'E174.1', '7D9E.1', 'B728.1'],
  NSPrivacyAccessedAPICategoryActiveKeyboards: ['3EC4.1', '54BD.1'],
};
const DATA_TYPES = new Set(['Name', 'EmailAddress', 'PhoneNumber', 'PhysicalAddress', 'OtherUserContactInfo', 'Health', 'Fitness', 'PaymentInfo', 'CreditInfo', 'OtherFinancialInfo', 'PreciseLocation', 'CoarseLocation', 'SensitiveInfo', 'Contacts', 'EmailsOrTextMessages', 'PhotosorVideos', 'AudioData', 'GameplayContent', 'CustomerSupport', 'OtherUserContent', 'BrowsingHistory', 'SearchHistory', 'UserID', 'DeviceID', 'PurchaseHistory', 'ProductInteraction', 'AdvertisingData', 'OtherUsageData', 'CrashData', 'PerformanceData', 'OtherDiagnosticData', 'EnvironmentScanning', 'Hands', 'Head', 'OtherDataTypes'].map((t) => `NSPrivacyCollectedDataType${t}`));
const PURPOSES = new Set(['ThirdPartyAdvertising', 'DeveloperAdvertising', 'Analytics', 'ProductPersonalization', 'AppFunctionality', 'Other'].map((p) => `NSPrivacyCollectedDataTypePurpose${p}`));
if (check(pm && typeof pm === 'object', 'error: ios.privacyManifests is missing')) {
  check(pm.NSPrivacyTracking === false, 'error: privacyManifests.NSPrivacyTracking must be false');
  check(!(pm.NSPrivacyTrackingDomains ?? []).length, 'error: privacyManifests.NSPrivacyTrackingDomains must be empty (no tracking)');
  const apis = new Map((pm.NSPrivacyAccessedAPITypes ?? []).map((a) => [a.NSPrivacyAccessedAPIType, a.NSPrivacyAccessedAPITypeReasons]));
  // React Native core, AsyncStorage and Expo modules use these four (Expo guide: docs.expo.dev/guides/apple-privacy).
  for (const cat of ['NSPrivacyAccessedAPICategoryUserDefaults', 'NSPrivacyAccessedAPICategoryFileTimestamp', 'NSPrivacyAccessedAPICategorySystemBootTime', 'NSPrivacyAccessedAPICategoryDiskSpace']) {
    check(apis.has(cat), `error: privacy manifest lacks required-reason API ${cat}`);
  }
  for (const [cat, reasons] of apis) {
    if (!check(cat in REASONS, `error: unknown required-reason API category ${cat}`)) continue;
    check(Array.isArray(reasons) && reasons.length > 0 && reasons.every((r) => REASONS[cat].includes(r)), `error: ${cat} has invalid reasons ${JSON.stringify(reasons)}`);
  }
  const collected = pm.NSPrivacyCollectedDataTypes ?? [];
  check(collected.length > 0, 'error: privacy manifest declares no collected data, but the app stores e-mail, photos, messages…');
  const seen = new Set();
  for (const d of collected) {
    const t = d.NSPrivacyCollectedDataType;
    check(DATA_TYPES.has(t), `error: unknown collected data type ${t}`);
    check(!seen.has(t), `error: collected data type ${t} declared twice`); seen.add(t);
    check(typeof d.NSPrivacyCollectedDataTypeLinked === 'boolean', `error: ${t} needs NSPrivacyCollectedDataTypeLinked`);
    check(d.NSPrivacyCollectedDataTypeTracking === false, `error: ${t} must have NSPrivacyCollectedDataTypeTracking false`);
    const ps = d.NSPrivacyCollectedDataTypePurposes;
    check(Array.isArray(ps) && ps.length > 0 && ps.every((p) => PURPOSES.has(p)), `error: ${t} has invalid purposes ${JSON.stringify(ps)}`);
  }
  for (const t of ['EmailAddress', 'UserID', 'PhotosorVideos', 'EmailsOrTextMessages', 'OtherUserContent']) {
    check(seen.has(`NSPrivacyCollectedDataType${t}`), `error: privacy manifest must declare NSPrivacyCollectedDataType${t} (collected by the app)`);
  }
  if (anySrc(/getCurrentPositionAsync/)) check(seen.has('NSPrivacyCollectedDataTypeCoarseLocation') || seen.has('NSPrivacyCollectedDataTypePreciseLocation'), 'error: location is collected but not declared in the privacy manifest');
  if (anySrc(/analytics_record/)) check(seen.has('NSPrivacyCollectedDataTypeProductInteraction'), 'error: consented analytics are collected but ProductInteraction is not declared');
}

// Icon: 1024×1024 PNG without alpha (App Store Connect rejects a marketing icon with an alpha channel).
const iconPath = ios.icon ?? app.icon;
if (check(typeof iconPath === 'string' && existsSync(join(ROOT, iconPath)), `error: app icon ${iconPath} not found`)) {
  const png = pngInfo(readFileSync(join(ROOT, iconPath)));
  check(png && png.width === 1024 && png.height === 1024, `error: ${iconPath} must be a 1024×1024 PNG`);
  check(png && !png.alpha, `error: ${iconPath} has an alpha channel/transparency; export it as RGB without alpha`);
}
const splash = app.splash?.image;
if (splash) check(existsSync(join(ROOT, splash)), `error: splash image ${splash} not found`);

// ---------------------------------------------------------------- eas.json
const eas = json('eas.json') ?? {};
const prod = eas.build?.production ?? {};
check(eas.cli?.appVersionSource === 'remote' || prod.autoIncrement, 'error: eas.json needs remote app versions or autoIncrement so every upload has a new build number');
check(prod.autoIncrement === true || prod.autoIncrement === 'buildNumber', 'error: eas.json build.production.autoIncrement must be true');
check(prod.channel === 'production', 'error: eas.json build.production.channel must be "production"');
check(prod.distribution !== 'internal' && !prod.developmentClient && !prod.ios?.simulator, 'error: eas.json build.production must be a store build (no internal distribution, dev client or simulator)');
check(prod.environment === 'production', 'error: eas.json build.production.environment must be "production" (EAS environment variables)');
check(eas.submit?.production && typeof eas.submit.production === 'object', 'error: eas.json submit.production is missing');

// ---------------------------------------------------------------- source: secrets, debug routes, admin links, web-only UI
for (const [file, text] of srcText) {
  text.split('\n').forEach((line, i) => {
    if (/console\.(log|info|debug|warn|error)\(/.test(line) && /(password|secret|token|service_?role|anon_?key|api_?key|authorization|session)/i.test(line)) {
      fail(`error: ${file}:${i + 1} logs a value that may be a secret: ${line.trim().slice(0, 120)}`);
    }
  });
  check(!/service_role|SUPABASE_SERVICE_ROLE|sk_live_|-----BEGIN [A-Z ]*PRIVATE KEY/.test(text), `error: ${file} contains a server secret or service-role reference`);
  check(!/process\.env\.EXPO_PUBLIC_\w*(SECRET|SERVICE|PRIVATE)/.test(text), `error: ${file} reads a secret through an EXPO_PUBLIC_ variable (public in the bundle)`);
}
const routes = listFiles(join(ROOT, 'src/app')).map((f) => relative(join(ROOT, 'src/app'), f));
for (const r of routes) check(!/(^|\/)(debug|dev|test|tests|playground|sandbox|storybook|_sitemap)[\w-]*\.(tsx|ts)$/i.test(r), `error: debug-only route src/app/${r} would ship in the release build`);
for (const [file, text] of srcText) {
  if (file.startsWith('src/app/admin/') || /src\/components\/(Admin|admin\/)/.test(file) || !/^src\/(app|components)\//.test(file)) continue;
  check(!/(push|replace|navigate|href)\W[^\n]*['"`]\/admin/.test(text), `error: ${file} links to the admin area; admin stays out of the normal user UI`);
}
const banner = srcText.get('src/components/WebUpdateBanner.tsx');
if (banner) check(/Platform\.OS !== 'web'/.test(banner), 'error: WebUpdateBanner must stay inert on native (Platform.OS guard)');

// Review-critical product flows (App Review 1.2, 5.1.1(v)) must stay wired.
const has = (file, re, msg) => check(re.test(srcText.get(file) ?? ''), `error: ${msg} (${file})`);
has('src/app/settings.tsx', /\/delete-account/, 'account deletion must be reachable from Settings');
has('src/app/privacy-data.tsx', /\/delete-account/, 'account deletion must be reachable from Privacy & data');
has('src/app/delete-confirm.tsx', /deleteAccount\(/, 'delete-confirm must call the delete-account function');
has('src/app/account-banned.tsx', /\/delete-account/, 'banned users must be able to delete their account');
has('src/app/account-suspended.tsx', /\/delete-account/, 'suspended users must be able to delete their account');
has('src/components/Profile.tsx', /\/report/, 'profiles must offer "report"');
has('src/components/Profile.tsx', /api\.block\(/, 'profiles must offer "block"');
has('src/app/chat.tsx', /\/safety/, 'chat must offer safety/report/block');
has('src/app/message-actions.tsx', /\/report/, 'messages must offer "report"');
has('src/app/me.tsx', /\/support-help/, 'support/moderation contact must be reachable from the profile tab');
has('src/app/support-help.tsx', /support_email/, 'the support screen must show the published support e-mail');
has('src/app/signup.tsx', /adult/,'signup must ask for 18+ confirmation');
has('src/app/ob-age.tsx', /terms_accepted/, 'onboarding must record acceptance of Terms and Community rules');
has('src/app/ob-age.tsx', /age\s*<\s*18/, 'onboarding must reject birthdates under 18');
has('src/lib/gateRoutes.ts', /RESTRICTED_OK[\s\S]*'\/delete-account'/, 'sanctioned users must keep access to account deletion');

// ---------------------------------------------------------------- legal URLs and support e-mail
const legalSrc = srcText.get('src/app/legal.tsx') ?? '';
const LEGAL_KEYS = [...legalSrc.matchAll(/\['(\w+)',\s*'screens\.legal\./g)].map((m) => m[1]).filter((k) => k !== 'subscriptions');
check(['privacy', 'terms', 'community'].every((k) => LEGAL_KEYS.includes(k)), 'error: the Legal screen must list privacy, terms and community documents');

if (!STRICT) {
  warn(`legal URLs (${LEGAL_KEYS.join(', ')}) and support_email live in the hosted app_config (seeded empty by migration 0008); run with --strict before a store build`);
} else {
  const env = { ...readDotEnv(), ...process.env };
  const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const envOk = check(/^https:\/\/[^/]+$/.test(url) && !/localhost|127\.0\.0\.1/.test(url), 'error: EXPO_PUBLIC_SUPABASE_URL must be the hosted https project URL (without it the app shows "not configured")')
    & check(anon.length > 20, 'error: EXPO_PUBLIC_SUPABASE_ANON_KEY must be set (public anon key)');
  if (envOk) {
    let cfg = null;
    try {
      const res = await fetch(`${url}/rest/v1/app_config?select=key,value&key=in.(legal_urls,support_email)`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
      if (res.ok) cfg = Object.fromEntries((await res.json()).map((r) => [r.key, r.value]));
      else fail(`error: reading app_config failed: HTTP ${res.status}`);
    } catch (e) { fail(`error: reading app_config failed: ${e.message}`); }
    if (cfg) {
      const legal = cfg.legal_urls && typeof cfg.legal_urls === 'object' ? cfg.legal_urls : {};
      for (const k of LEGAL_KEYS) {
        const v = legal[k];
        if (!check(typeof v === 'string' && /^https:\/\/\S+$/.test(v), `error: app_config.legal_urls.${k} is empty — fill it in admin → Настройки → Документы и поддержка`)) continue;
        try {
          const r = await fetch(v, { method: 'GET', redirect: 'follow' });
          check(r.ok, `error: legal page ${k} (${v}) answers HTTP ${r.status}`);
        } catch (e) { fail(`error: legal page ${k} (${v}) is unreachable: ${e.message}`); }
      }
      check(typeof cfg.support_email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.support_email), 'error: app_config.support_email is empty — fill it in admin → Настройки → Документы и поддержка');
    }
  }
  const sub = eas.submit?.production?.ios ?? {};
  if (!/^\d+$/.test(String(sub.ascAppId ?? ''))) warn('eas.json submit.production.ios.ascAppId is not set (App Store Connect → App Information → Apple ID); `eas submit` will ask interactively');
  if (!/^[A-Z0-9]{10}$/.test(String(sub.appleTeamId ?? ''))) warn('eas.json submit.production.ios.appleTeamId is not set (developer.apple.com → Membership → Team ID)');
  warn('demo bots: run scripts/check-no-demo-bots.sql against production before public launch (cannot be checked with the anon key)');
}

// ---------------------------------------------------------------- report
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.error(e);
if (errors.length) { console.error(`release check FAILED: ${errors.length} problem(s), ${passed} checks passed`); process.exit(1); }
console.log(`release check ok (${passed} checks${STRICT ? ', strict' : ''})`);

// ---------------------------------------------------------------- helpers
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** Width/height and whether the PNG can carry transparency (alpha colour types or a tRNS chunk). */
function pngInfo(buf) {
  if (buf.length < 33 || buf.toString('latin1', 1, 4) !== 'PNG') return null;
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20), colorType = buf[25];
  let alpha = colorType === 4 || colorType === 6;
  for (let off = 8; off + 8 <= buf.length;) {
    const len = buf.readUInt32BE(off), type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'tRNS') alpha = true;
    if (type === 'IEND') break;
    off += 12 + len;
  }
  return { width, height, alpha };
}

function readDotEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return {};
  return Object.fromEntries(readFileSync(p, 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]));
}
