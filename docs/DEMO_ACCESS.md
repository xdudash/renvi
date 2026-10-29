# Existing demo account access

No hosted demo password resets have been performed as part of this change. The connected hosted database account does not have permission for the RENVI project. No existing credential is known or stored in this repository.

After migration `0027_admin_demo_access.sql` and the `demo-access` Edge Function are deployed, sign in as a RENVI administrator and open **Демо-доступ** (`/admin/demo`). The page queries existing Auth emails and profile names; it does not invent test identities or create accounts.

For one listed account, leave the password field empty and press **Задать пароль** to generate a simple random password. Optionally enter a custom password of at least 8 characters and at most 72 UTF-8 bytes. The reset does not change email confirmation status. Seeded demos already have confirmed emails. Copy the displayed email and password and use the normal sign-in screen in a separate session or after signing out. Data is revealed only after Auth confirms success. Hide the result when finished; leaving the page discards its in-memory credentials. Copying explicitly places those credentials on your device clipboard.

Only `demo_bots` members with an exact `@demo.renvi.app` email domain and no `admins` membership qualify. The SQL listing checks the caller's administrator status. The Edge Function verifies the caller with Auth and `is_admin`, queries that listing with the caller's JWT, verifies the current Auth identity and email, then checks the demo/admin memberships again. It revalidates the Auth email and membership after reserving the audit, immediately before updating the password. The service key remains server-side. Real accounts and administrators are excluded regardless of the supplied UUID.

Each reset reserves `admin_actions.action = 'demo.password_reset'` before touching Auth. The audit contains the actor and target, never the password. Its status changes from `requested` to `confirmed`, `unconfirmed` or `denied`. A failure to reserve the audit blocks the reset. A completed reset with a failed final audit update is reported as successful with a journal warning; the original audit survives. Network failures may leave the Auth result unconfirmed: the UI shows no credential, and repeating the reset sets a new password. Auth and PostgreSQL are separate services, so their writes are not one transaction; do not concurrently change demo membership, email or admin privileges while resetting that account.

The function requires a valid JWT (`verify_jwt = true`). Use the existing all-functions deployment workflow. Apply the migration before using the page. This implementation has local regression coverage; hosted login verification remains a post-deployment task for an authorized RENVI operator.

Local checks:

```sh
node --experimental-strip-types --test scripts/tests/demo-access.test.mjs
npm run typecheck
npm run lint
```

The database suite also runs `supabase/tests/demo_access.sql` to verify listing scope and access controls. All test identities are transaction-scoped synthetic fixtures.
