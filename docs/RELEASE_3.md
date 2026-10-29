# RENVI: analytics, identity and mobile continuation

## Included

- Admin analytics dashboard and per-user measured activity, with explicit consent, foreground-only active time, normalized screen ids and allowlisted successful product actions. Demo users are excluded. No chat text, photos, coordinates or arbitrary event properties are ingested. UTC day1/day7/day30 returns are measured only for mature cohorts; unavailable anonymous first-visit data is not fabricated.
- First chosen birthday and gender are immutable on the server. Corrections are available only to admins with an audit reason. Private birthdate is returned only to its owner/admin, public age is computed from birthdate.
- Verified-email signup/callback and password recovery paths for web/iOS. Local confirmation is enabled; hosted Auth/SMTP still needs Dashboard setup in AUTH_SETUP.md.
- Admin demo access lists existing demo accounts only and permits generated/custom passwords. Actual deployed password changes happen only after the administrator uses the new screen; no passwords are embedded in code, logs or migrations.
- Mobile safe area, scrollable sheets, keyboard handling, wrapping and touch target fixes. Screenshot QA uses fictitious local data, CI artifacts expire after7days. Browser viewport checks do not replace native iPhone QA.
- Additional audit fixes: transactional subscription commits, late transfer protection, serialized match consent, concurrent referral generation, config type validation, moderated media access; durable chat send and cold-offline outbox UI.

## Deployment

1. Review and merge the PR. Web deploy publishes the client automatically.
2. Run Deploy Supabase on main to apply0025–0028 and deploy all Edge Functions, including demo-access. The existing three GitHub Supabase secrets are used; no service key belongs in the client.
3. Complete AUTH_SETUP.md on the hosted RENVI project: confirmations, SMTP, exact web/native redirect URLs and email templates. Config.toml local Auth settings are not deployed by db push.
4. Sign in as an admin and open /admin/analytics and /admin/demo. Pick an existing demo email; choose or generate its password. Confirm success on screen, then sign into a separate browser/profile/device with those credentials.
5. Check pg_cron maintenance scheduling and existing optional RevenueCat/push/digest/provider secrets. A successful function deployment does not prove its providers are configured.
6. Run native iOS QA on a signed development build before App Store submission. This change alone is not App Store readiness certification.

## Verification boundary

Hosted RENVI database administration and the user's authenticated admin browser are not accessible to this development connection. No production migration, hosted password reset, SMTP email or StoreKit purchase was executed as part of this branch. Local SQL, client/Edge tests and browser QA results are recorded in the PR and MOBILE_QA.md.
