# Stub cleanup inventory

Audit of `src/` (Russian and English markers: скоро, в разработке, заглушк, демо, Coming soon, beta, NEW, TODO/FIXME/XXX, lorem, example.com, "появится", empty `onPress`, fake counters/cards, unreferenced routes, prototype-only screens). Result: the product code held no "coming soon" badges, TODO/FIXME markers, lorem text or example.com links. The findings were prototype-gallery leftovers and a few dead affordances.

| File | What it was | Action taken |
|---|---|---|
| `src/app/loading.tsx` | Prototype-only "Загрузка" screen (nobody navigated to it; real loading uses `LoadingCards` inline in discover) | Deleted; removed from `e2e/screen-map.mjs`; removed unused `screens.loading.*` i18n keys |
| `src/app/empty-chats.tsx` | Prototype-only route wrapping `EmptyChats` (the real empty state is rendered inside `/chats`) | Deleted; screen-map entry removed |
| `src/app/empty-discover.tsx` | Prototype-only route wrapping `EmptyDiscover` (real empty state is rendered inside `/discover`) | Deleted; screen-map entry removed |
| `src/app/chat-history.tsx` | Redirect to `/chat?history=1` for the prototype "history" state; nothing linked to it | Deleted with the `history` param and its effect in `src/app/chat.tsx`; screen-map entry removed |
| `src/app/offline.tsx`, `src/app/error-retry.tsx` | Prototype names, but real states (`lib/discover.tsx` routes to `/offline`; discover/likes/profile route to `/error-retry`) | Kept (wired into real flows) |
| `src/app/legal.tsx` | Rows for documents without a published URL opened a toast "Документ ещё не опубликован" (dead row) | Rows are listed only when `app_config.legal_urls` has a link; toast and key `screens.legal.dokumentNameEscheNe` removed |
| `src/components/Profile.tsx` | Decorative "ⓘ" glyph next to the distance with no handler | Removed |
| `src/app/edit-music.tsx` | Music field | Kept: it is already a real integration (Spotify oEmbed via `resolveSpotify`) or a plain text title; no fake search results. Nothing to change |
| `src/app/icebreakers.tsx`, `src/app/opening-moves.tsx` | Conversation starters | Kept: topics come from the match's real prompts/interests; the three suggested openers are real editable content stored in `opening_moves` |
| `src/app/match.tsx` | Hard-coded "Make it mutual." brand tagline | Kept (brand copy, not data) |
| `e2e/capture-prototype.mjs`, `e2e/capture-all.mjs`, `e2e/sheets.py`, block in `e2e/run-all.sh` | Prototype side-by-side screenshot gallery (needs the private prototype HTML) | Deleted; `README.md` no longer claims "94 prototype screens" |
| `name@example.com` placeholders (signin, signup, forgot, admin/admins) | TextInput input hints | Kept (allowed input hints) |
| `src/app/admin/demo.tsx`, demo-bot admin tiles, `scripts/*demo-bots*` | Admin tools to reset/remove DB demo accounts before launch | Kept: they exist to remove fake data; the demo profiles themselves live in the database, not in the client |
| `src/app/purchase-state.tsx` (`onPress={() => {}}`), plans/billing screens, `/plans` topic in `support-help.tsx`, `subscriptions` doc in `legal.tsx` | Subscription surface | Not touched (owned by the agent that removes subscriptions) |

No migration was needed (`0031_stub_cleanup.sql` unused).
