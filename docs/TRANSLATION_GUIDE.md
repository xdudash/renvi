# RENVI translation guide (RU -> EN / SK / CS / UA)

RENVI is a dating app for Slovakia (users: Slovaks, Czechs, Ukrainians living there, expats). Source language is Russian.
You are NOT translating word for word. You are writing the app text the way a native 25-35 year old would say it
in a good dating app. Meaning and safety/legal content stay exact; the wording is yours.

## Voice
- Informal address: "you" / ty (SK, CS, lowercase) / ти (UA). Never the formal vy/Vy/ви.
- Plain, concrete, short. Say what happened and what to do next. One idea per sentence.
- Buttons and tabs: 1-3 words, a verb when it is an action. Match the length of the Russian (+-30%) so the UI does not break.
- Keep ALL-CAPS where the source is ALL-CAPS (eyebrows/labels), and sentence case elsewhere (no Title Case in SK/CS/UA; EN: sentence case too).
- Keep punctuation style of the source: exclamation marks only where the source has one.

## Anti-slop (hard rules)
- No marketing or AI-sounding filler: "seamless", "unlock", "elevate", "journey", "empower", "dive in", "discover amazing",
  "Oops!", "Let's get started!", "Don't worry", "Please note", "We're here for you", "Welcome to the world of...".
- No padding: do not add words, reassurance, emoji or sentences that the source does not have. Do not explain more than the source.
- No calques. Slovak must read as Slovak (no Czechisms), Czech as Czech (no Slovakisms), Ukrainian as modern Ukrainian
  (no Russianisms: not "приймати участь", "на протязі", "слідуючий", "получити"), English as plain international/UK-US neutral.
- No stacked triplets, no rhetorical flourishes, no "not just X, but Y".
- Errors: what failed + what to do. No blame, no apology unless the source apologises.
- Gender: Russian often uses "отправил(а)", "заполнил(а)". Rephrase neutrally (e.g. SK "poslal(a)" is acceptable only if
  no neutral form exists; prefer wording like "Spark sent" / "Iskra odoslaná"). Never use a masculine default for the user.

## Do not change
- Placeholders like {name}, {count}, {city}: copy exactly, same set in every translation (order may change).
- Brand RENVI. URLs, e-mail addresses, emoji, symbols (·, ×, ›, ‹, →). Numbers.
- Legal/safety meaning: age 18+, consent, account deletion, data export, reports/blocks, appeal rights, moderation outcomes.

## Glossary (use exactly these product terms; inflect as the language needs)
| RU | EN | SK | CS | UA |
|---|---|---|---|---|
| Искра / Искры (a like, "spark") | Spark / Sparks | Iskra / Iskry | Jiskra / Jiskry | Іскра / Іскри |
| Знакомства (main tab) | Discover | Objavuj | Objevuj | Знайомства |
| Чаты | Chats | Správy | Zprávy | Чати |
| Профиль | Profile | Profil | Profil | Профіль |
| Анкета (the user's profile card) | profile | profil | profil | анкета |
| Совпадение | match | zhoda | shoda | збіг |
| Свидание | date | rande | rande | побачення |
| Жалоба / пожаловаться | report | nahlásenie / nahlásiť | nahlášení / nahlásit | скарга / поскаржитися |
| Заблокировать | block | zablokovať | zablokovat | заблокувати |
| Проверен(а) (verified badge) | verified | overený | ověřený | підтверджений |
| Селфи-проверка | selfie check | overenie selfie | ověření selfie | перевірка селфі |
| Апелляция | appeal | odvolanie | odvolání | апеляція |
| Поддержка | support | podpora | podpora | підтримка |
| Аккаунт | account | účet | účet | акаунт |
| Намерение (what you look for) | what you're looking for | čo hľadáš | co hledáš | кого шукаєш |
| Видеозвонок до встречи | video call before the date | videohovor pred randením | videohovor před rande | відеодзвінок перед побаченням |
| Итоги недели | Your week | Tvoj týždeň | Tvůj týden | Твій тиждень |

Context for the RU sources: key names are transliterated Russian and sometimes hint at the screen (e.g.
`screens.filters.*` = filters screen). Read neighbouring keys to keep one voice per screen. You may read the repo
(`/home/claude/renvi/src`) to see where a key is used when its meaning is unclear. Do NOT edit the repo.

## Output
A single JSON object {key: translated string} with EXACTLY the same keys as the input file, nothing else. Valid JSON,
UTF-8, no trailing commas. Write it to the path you are given using the Write tool, then run the validator command
you are given and fix every reported problem before finishing.

---
## Status (2026-10-31)
SK, CS, EN and UA were written from the Russian source (all user-facing keys; the admin panel `adm.*` stays Russian).
They have **not** been reviewed by native speakers. Before launch have one person per language read the app once;
fix wording directly in `src/i18n/{sk,cs,en,ua}.ts` (keep `{placeholders}`; `node scripts/check-i18n.mjs` checks them).
Known compromises: a few strings keep "(a)" / "sám/sama" where no gender-neutral wording exists;
SK/CS/UA plurals are avoided by "label: number" phrasing instead of counted nouns.
