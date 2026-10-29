# Mobile layout QA — release 3

Native iOS is the primary app. The automated results below exercise the Expo web renderer in Chromium with touch enabled; they do not establish native iOS compatibility.

## Observed and fixed

A baseline web export at 393×852, 375×667 and 320×568 showed header buttons at 34×34 and back/link controls 28px high. All 21 public route/viewport rows failed the 44px target regression. The same seven public routes passed after the shared controls were enlarged: no measured targets below 44px, horizontal overflow, page exceptions or redirects. The routes were welcome, language, sign in, sign up, forgot password, confirmation and invite-not-found.

A second capture used browser-intercepted, fictitious signed-in data on 16 route/state variants at the same three widths: age, gender, seeking, intent, city, about, prompts and location onboarding; settings, privacy visibility, privacy data, plans, filters and legal, plus saved/read-only birthday and gender variants. All 48 route/viewport rows opened the intended route with no page exceptions, visible horizontal overflow or undersized controls with button/tab/checkbox roles. This is layout evidence, not backend or authentication verification. The fixture does not perform database writes.

The editable birthday scenario opens day/month/year pickers, scrolls to 1995, selects 15 June 1995, opens confirmation, confirms that touching sheet content does not dismiss it through the backdrop, and cancels without saving. The saved-birthday scenario asserts that its day control is disabled.

Screenshots manually inspected included the 320px sign-up baseline, 320px sign-in after the change, intent onboarding at 320px and 393px, and the birthday confirmation sheet at 320px and 393px. The narrow layouts wrap text and retain vertical scrolling. Other captured screens have automated measurements, not exhaustive manual visual review.

The shared screen scroll view now opts into native iOS keyboard insets and interactive dismissal. Bottom sheets have a scrollable body and bottom safe-area padding. Administration confirmation forms have keyboard avoidance and scrolling; compact actions, filters and tabs have actual 44px targets. Shared metadata rows can wrap, and admin key/value labels no longer reserve a fixed 150px on narrow screens. These native behaviors still require device verification.

## Reproduce

Install dependencies and Chromium using the normal project setup. Build and serve a local web export. For the standalone fixtures, build with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and a non-secret placeholder anon key; every fixture request to that API is intercepted in Playwright. Run from `e2e/`:

```sh
APP_URL=http://127.0.0.1:8081 node screens.mjs --public --strict-targets
APP_URL=http://127.0.0.1:8081 MOBILE_QA_OUTPUT=out/screens/fixtures node screens.mjs --fixtures --strict-targets
node layout-audit.test.mjs
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an already installed Chromium binary. `MOBILE_QA_OUTPUT` selects the capture directory; the default is `out/screens`. Every run writes screenshots plus JSON and Markdown reports. Unless `--report-only` is selected, exit status is nonzero on navigation failures, blank roots, redirects, page exceptions or visible overflow. `--strict-targets` also fails targets smaller than 44×44. Full seeded captures keep small-target findings advisory so the report identifies existing screen-specific controls for follow-up.

For the full real-backend local fixture run, first run `e2e/run-all.sh` against disposable local Supabase, then run `node screens.mjs` from `e2e/`. This seeded route inventory is a CI gate: an unexpected redirect, navigation failure, page exception or visible overflow on any row fails the job (`--report-only` lists findings without failing, for local exploration). Screens whose redirect on a cold URL load is their intended behaviour are declared in `expectedRedirects` in `e2e/screen-map.mjs` with a reason; such a row must land exactly on the declared target, so the redirect is verified rather than ignored. Today that is only `match` → `/chats` (the celebration needs the in-memory result of the spark that just matched). The invite landing is captured with Anna's real referral code from `my_referral`, not a made-up code. Small targets stay advisory in the seeded inventory and are recorded in JSON; public and mocked fixture runs gate them with `--strict-targets`. The map validates required seeded matches, dates, messages, reports and the invite code rather than silently capturing undefined IDs. Identical likes routes are represented once; the tool does not claim that one account exercised three subscription tiers.

Horizontal overflow measurements ignore content clipped within an in-bounds scroll container, such as admin tables and navigation, while checking the scroll container's own bounds. The measurement regression covers intentional scroll content, left/right overflow and touch-target dimensions. Text truncation still needs visual review.

CI gates the public and mocked fixture checks and the full seeded route inventory, and captures only local fictitious fixtures. It uploads evidence as artifacts with seven-day retention, and never publishes a screenshots branch. Screenshots, session state and generated reports remain ignored by git. The screenshot tools reject hosted app/API endpoints.

## Remaining native checks

Before native release, verify on an iPhone SE-size device and a current notched iPhone:

- Keyboard focus and scrolling for birthday, sign-up, long profile fields and admin reason forms, including dismissal and reaching submit controls.
- Sheet content scrolling, backdrop dismissal, close action, and home-indicator/notch padding, including large text.
- VoiceOver labels, focus order and modal focus containment; Dynamic Type, reduced motion and 44pt touch targets.
- Long localized labels, photo/media states, offline chat composition and authenticated navigation with actual native data.

No simulator, physical iPhone, native keyboard, VoiceOver or Dynamic Type test was performed in this environment. The complete seeded screen sweep requires local Supabase and was not executed in this browser-fixture run.
