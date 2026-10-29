# Bug hunt — 2026-10-29

Systematic review of the iOS app (Expo SDK 58) and the Supabase backend, area by area, plus CI hygiene and the mobile route inventory. Every fix has a check:

- **SQL**: `supabase/tests/bugfixes.sql`, run by `scripts/test-db.sh` (36 checks).
- **Client logic**: `scripts/tests/bugfixes-client.test.mjs` (`node --test`). It covers the pure modules in `src/lib`, plus source guards for call sites that cannot run without React Native.
- **CI / inventory**: `scripts/tests/ci-pins.test.mjs` and `scripts/tests/inventory.test.mjs`.

None of this was run on a device. The "Not verified" section lists what still needs an iPhone.

## CI

| | |
|---|---|
| **Where** | `.github/workflows/e2e.yml`, `deploy-supabase.yml`, `eas-build.yml`, all `runs-on` |
| **Symptom** | E2E and deploy runs broke without any repository change. |
| **Cause** | `supabase/setup-cli` used `version: latest`. Each new CLI release, with its new local-stack images, reached CI the day it shipped. EAS CLI and the runner image floated on `latest` in the same way. |
| **Fix** | Supabase CLI is pinned to `2.120.0` in both workflows. The release was checked: it is tagged and has release assets. EAS CLI is pinned to `27.1.0`; builds run the installed `eas` instead of `npx eas-cli@latest`. Runners use `ubuntu-24.04`. |
| **Test** | `ci-pins.test.mjs` fails if a workflow uses `latest`, `@latest` or a `*-latest` runner, or if the two Supabase pins differ. |

## Mobile route inventory (6 of 276 rows)

The seeded inventory opens 92 screens at 3 widths. The 6 findings were 2 screens × 3 widths.

| Screen | Symptom | Cause | Fix |
|---|---|---|---|
| `invite-link` | Redirected to `/invite-not-found` | The map used `/invite/ANNA`, which is not a referral code. The screen correctly treated it as invalid. | The map uses Anna's real code from `my_referral`. |
| `match` | Redirected to `/chats` | Intended. The match celebration needs the in-memory result of the spark that just matched, and a cold URL load has none. | Declared in `expectedRedirects` in `e2e/screen-map.mjs`, with its reason. The row must land exactly on `/chats`. |

The inventory is now a **gating** CI step, "Mobile web route inventory". It fails on any unexpected redirect, navigation failure, page error or overflow. `--report-only` is still available for local exploration. The rules live in `e2e/inventory.mjs`, and `inventory.test.mjs` covers clean rows, every finding type, verified expected redirects and validation of the redirect declarations.

The `date-pending` / `date-incoming` / `date-accepted` rows open accepted or declined dates. After B1 they render that status in place instead of redirecting, so they stay clean.

## Client

### B1 — Invitation screens ignored the real status
- **Where**: `date-pending.tsx`, `date-incoming.tsx`, `date-accepted.tsx`
- **Symptom**: An already declined or cancelled invitation still offered Accept / Decline / "Propose another time", and tapping one failed with "could not respond". An accepted invitation was shown as "awaiting reply" with Cancel. This happened when the screen was opened from a push, the back stack or a stale chat card.
- **Cause**: The screens hard-coded the pending UI.
- **Fix**: `src/lib/dateStatus.ts` (`dateView`) derives the chip, tone and allowed actions from the row's status and from who proposed. Actions are shown only when the server would accept them.
- **Test**: B1 in `bugfixes-client.test.mjs`.

### B2 — Past time slots and stale draft days
- **Where**: `date-time.tsx`, `date-create.tsx`
- **Symptom**: At 18:00 the picker still offered today's 14:00. A draft day from an earlier visit (yesterday, or a day from the other week tab) was still sent.
- **Cause**: The server checks only `day >= current_date`, and the UI offered every slot.
- **Fix**: `src/lib/dateSlots.ts` offers only days with remaining slots and only times still ahead. A day that is no longer offered is deselected, and a past draft day is reset.
- **Test**: B2 in `bugfixes-client.test.mjs`. The e2e "propose a date" step now picks next Monday so it does not depend on the CI clock.

### B3 — Double submits
- **Where**: `Btn` in `components/ui.tsx`, which every form uses
- **Symptom**: A fast double tap sent two requests: two invitations, two appeals, two declines.
- **Cause**: `busy` disables the button only after a re-render.
- **Fix**: `src/lib/pressGuard.ts`. While the handler's promise is pending, further presses are dropped.
- **Test**: B3.

### B4 — Push taps on a killed app opened nothing
- **Where**: `app/_layout.tsx`
- **Symptom**: Tapping a message notification when the app was not running opened the home screen instead of the conversation.
- **Cause**: Only `addNotificationResponseReceivedListener` was used. Per the SDK 58 docs, the response that launched the app must be read with `getLastNotificationResponseAsync`. The route was also accepted unvalidated.
- **Fix**: The launch response is read once and cleared, each tap is handled once, and `src/lib/pushRoute.ts` allows only app routes.
- **Test**: B4.

### B5 — Tab badge queried the server on every screen
- **Where**: `TabBar` / `useIncomingCount` in `components/ui.tsx`
- **Symptom**: Every navigation ran `incoming_sparks()` again, because every `Screen` mounts its own `TabBar`.
- **Fix**: `src/lib/cachedLoader.ts` gives one shared request per account with a 30 s cache. A failure is not cached.
- **Test**: B5.

### B6 — Realtime channel collision
- **Where**: `lib/chat.ts`
- **Symptom**: Opening "message not sent" or "photo not sent" above a conversation could throw, because supabase-js returns the already-joined channel and `.on()` / `.subscribe()` on it throws. Going back then left the chat without live messages, because the second screen's cleanup removed the shared channel.
- **Cause**: Every `useChat` used the same topic, `messages:<match>`.
- **Fix**: Each instance gets its own topic (`src/lib/chatLogic.ts` `channelTopic`). The filter is unchanged.
- **Test**: B6.

### B7 — "History" did not load history
- **Where**: `app/chat.tsx` (`?history=1`), `lib/chat.ts` `loadOlder`
- **Symptom**: History mode fetched the newest page again. `loadOlder` also leaked an unhandled promise rejection on network errors.
- **Cause**: It ran on mount, before the first page existed, and so asked for messages "before null". `loadOlder` used try/finally with no catch.
- **Fix**: History waits for the first page and runs once (`historyCursor`). `loadOlder` never rejects.
- **Test**: B6/B7 (`historyCursor`).

### B8 — Media viewer showed a blank frame for a bad `at`
- **Where**: `media-viewer.tsx`
- **Fix**: `clampIndex` keeps the URL index inside the list.
- **Test**: B6 (`clampIndex`).

### B9 — Offline sign-in reported a wrong password
- **Where**: `signin.tsx`, `signup.tsx`, `forgot.tsx`
- **Fix**: `src/lib/authErrors.ts` recognises network failures, and the screens show "No connection" for them.
- **Test**: B9.

### B10 — Failed settings saves left switches flipped
- **Where**: `hooks/usePrefs.ts` (notification and accessibility toggles)
- **Symptom**: The toast said the save failed, but the switch stayed in the new position, unlike the server.
- **Fix**: `src/lib/optimistic.ts` rolls the switch back unless a later tap changed it.
- **Test**: B10.

### B11 — Russian text in SK/CS/EN/UA
- **Symptom**: Russian text appeared in the other languages in these places:
  - the intent chip (profile card, profile, onboarding done) and the filter pills
  - intent titles and descriptions in onboarding
  - date place labels, names and districts (ticket, date-create, date-place)
  - interest chips on the profile card, profile and discover
  - prompt questions in prompt cards, chat and icebreakers
  - the video call time, hard-coded to `ru-RU`
- **Cause**: Catalog fields hold the Russian originals, and these call sites did not translate them, although translation keys existed.
- **Fix**: `intentChip(k, t)` and `placeLabel(..., t)` are now used everywhere, along with `interestLabel` / `promptLabel`. `PromptCard` translates centrally, and the video call uses `localeOf()`.
- **Test**: B11 checks the catalog values against the EN dictionary and guards every call site.

### B12 — VoiceOver users could not send a spark
- **Where**: `SparkButton`, `HoldButton`
- **Cause**: Both were hold-only. A VoiceOver double tap cannot hold.
- **Fix**: An `activate` accessibility action sends the spark.
- **Test**: B12 (source guard). Needs VoiceOver confirmation on a device.

### B13 — Stale screens after navigating back
- **Where**:
  - `chats`: unread counts and last message
  - `archive`
  - `me`: avatar, completeness and counters after editing
  - `edit-profile`: media and prompt summaries
  - `likes`
  - `chat`: photo consent, date card and read state; the icebreaker opener never reached the composer
- **Cause**: Stack screens stay mounted and loaded their data only on mount. The chat screen also kept its state when it was reused for another match.
- **Fix**: `hooks/useReloadOnFocus.ts` reloads on refocus. The chat screen picks up the stored draft on refocus and is keyed by match.
- **Test**: B13 (source guards).

### B14 — Saved answers and opening moves could be lost
- **Where**: `hooks/usePrompts.ts`, `opening-moves.tsx`, `edit-prompts.tsx`, `ob-prompts.tsx`
- **Symptom**: A failed save deleted every answer or topic. A failed load showed suggestions or blanks, and saving then overwrote the real data.
- **Cause**: The save was a client-side "delete all, then insert" whose errors were partly ignored, and load errors were swallowed.
- **Fix**: Atomic RPCs `save_prompts` / `save_opening_moves` (S4). A load error shows a retry, and saving is disabled until the data is known.
- **Test**: B14 plus S4 in `bugfixes.sql`.

### B15 — One request per row in the chat and likes lists
- **Where**: `ChatRow`, likes `IncomingRow`
- **Cause**: Each row called `profile_card()` for its avatar and verified tick.
- **Fix**: The lists use `partner_photo` / `partner_verified` and `photo` / `verified` from the list RPCs (S2/S3). The per-row call is kept only as a fallback for an older database.
- **Test**: B15 plus S2/S3.

### B16 — Load errors looked like empty lists
- **Where**: `report-status.tsx`, `blocked.tsx`
- **Symptom**: A failed load showed "no reports yet" or "you blocked nobody".
- **Fix**: These screens now show a retry state.
- **Test**: B16.

### B17 — "Propose another time" ignored a failed decline
- **Where**: `date-incoming.tsx`
- **Symptom**: When the decline failed, the old invitation stayed pending next to the new one.
- **Fix**: The app moves on to a new proposal only after the decline succeeded. Otherwise it shows a toast. Busy-guarded.
- **Test**: Covered by the B1 flow and B3. The e2e "incoming date" step exercises the screen.

## Server (`supabase/migrations/0030_bugfixes.sql`)

| ID | Where | Symptom / cause | Fix | Test (`bugfixes.sql`) |
|---|---|---|---|---|
| S1 | indexes | Sequential scans on hot paths. `matches.user_b` in the "user_a = me or user_b = me" filter of `list_matches` / `incoming_sparks`. The reverse direction of `is_blocked_pair`. Per-sender spark and pass counts (daily limit, undo). Reports by reporter. Appeals. Sanctions (checked on every action). Push tokens per user. Opening moves. | Ten `create index if not exists` | S1 (leading columns asserted) |
| S2 | `incoming_sparks()` | With more than 100 sparks, an arbitrary 100 were returned, because `limit 100` was applied before ordering. Plus the N+1 from B15. | Order before the cut. Items carry the cover **photo** (never a video) and `verified`. | S2 |
| S3 | `list_matches()` | No `ORDER BY`. The last message was looked up twice per row. N+1 avatars. | Ordered by last activity, last message read once through a lateral join, `partner_photo` / `partner_verified` added. Same filters as before. | S3 |
| S4 | prompts / opening moves | Data loss (B14) | `save_prompts(jsonb)` and `save_opening_moves(text[])`: validated, one transaction, own rows only | S4 |
| S5 | `send_message()` | `p_body = null` with no photo stored an empty message; only a blank non-null body was rejected. | Patched into the current definition: an empty body and no photo is rejected with 22023. | S5 |
| S6 | `respond_date()` | Two answers to the same invitation, or an answer racing a cancel, both passed the "still pending" check, and the last write won. | Row read `FOR UPDATE` | S6 |
| S7 | `save_filters()` | An empty intents array made `discover()` match nobody forever. A null age bound passed the range check and crashed on NOT NULL with a raw 23502. | Empty or unknown intents are treated as "all". A missing bound returns a clear 22023, and a missing distance means the maximum. | S7 |

Realtime publication: the client subscribes only to `messages`, which is published by migration 0011, so there is no gap for current subscriptions. Read receipts and the date card still don't update live; they now refresh on focus (B13). Making them live would be a feature, not a fix.

## Found, not changed

Reported for follow-up. Either other agents own the code (plans, billing, stub screens, `app.json` / `eas.json`), or a fix needs a product decision.

- The plural rules for the likes count are Russian rules for every language (`likes.tsx`, plan-gated screen).
- `distance_label()` returns Russian text from the server ("в вашем городе", "≈ N км").
- Daily like limits and `likes_today()` reset at UTC midnight (01:00–02:00 in Slovakia).
- `match_context().opening_moves` mixes the user's own topics with the partner's in the chat starters.
- More than one pending invitation per match is allowed. The chat card shows only the newest.
- The admin layout treats an `is_admin` RPC error as "no access".

## Not verified without a device

- Native iOS behaviour:
  - push cold start routing (B4) and the clearing of the last response
  - the VoiceOver `activate` action on the spark buttons (B12)
  - focus refresh in the native stack (B13)
  - keyboard and safe-area behaviour of the changed screens
- The full seeded web inventory and the e2e suite: they need Chromium, a local Supabase stack and an npm install, none of which are available here (the registry is blocked). The inventory analysis above comes from reading the code.
- TypeScript: each changed file was transpiled with `ts.transpileModule` with 0 diagnostics. A full `tsc --noEmit` and `expo lint` need `node_modules`.
