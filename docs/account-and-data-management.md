# Account and data management

Accessibility preferences use a separate explicit guest or per-user device key. They are not authored Sanctuary records, are not included in guest clearing, and do not migrate automatically between guest and account scopes. See `docs/accessibility-controls.md` for the validated model and current cloud-persistence limitation.

## Architecture audit

`js/auth.js` remains the single shared browser authentication entry point for email/password, Google OAuth, sign-out, and auth-state announcements. `js/environment.js` remains the only authority for deployment paths and redirect origins. Account controls are mounted inside **Sanctuary Settings → Account & Data** by `js/account-data-ui.js`; pure validation, provider detection, safe error mapping, guest clearing, and sync state live in `js/account-data.js`. No token, provider secret, password, or privileged credential is rendered or persisted by these modules.

The shared auth listener publishes the resolved user. Account operations re-read that current user, and sync status is keyed by immutable user ID, not email. Signing out resets the account and sync presentation. Existing feature-specific stale-hydration guards remain authoritative.

## Account summary and data location

Signed-in users see email, reliably detected sign-in methods, cloud state, and the last successful cloud persistence observed on this device. The timestamp advances only when a signed-in settings or Living Library cloud save succeeds. It does not advance for guests or failures. Online/offline changes update status, and timestamps use `saltAndSovereigntyLastCloudSync:<user-id>` so one account never inherits another account's display.

Signed-in data is cloud-backed, while temporary drafts and caches can remain local. Signing out does not delete cloud data. Guest work stays in the current browser and never automatically moves into an account. Complete backups remain recommended in either mode.

## Password recovery and account changes

All sign-in forms expose **Forgot your password?**. Recovery calls Supabase's browser API with `SaltEnvironment.oauthReturnUrl('/account/reset-password/')` and always uses the neutral success message: “If an account exists for that email, a recovery link has been sent.” The reset page loads `environment.js` before Supabase configuration, validates an active recovery session, requires matching passwords of at least eight characters, uses `autocomplete="new-password"`, and never renders raw provider errors.

Email/password identities can change a password with `auth.updateUser`. Google-only accounts receive an accurate provider message rather than a fictional password form. Email changes use `auth.updateUser`, retain the same canonical user ID, and are presented as pending until Supabase confirmations update the actual Auth user. Project settings determine whether both old and new addresses must confirm.

## Guest clearing

Guest clearing requires a successfully downloaded fresh guest backup and the exact phrase `CLEAR MY GUEST DATA`. It uses the explicit `SaltAccountData.GUEST_KEYS` allow-list and never calls `localStorage.clear()`. The list covers guest settings, Altar layouts/draft, Library/layouts, Apothecary, rituals/lifecycle, custom Cabinet items, mundane preference, and supported Altar/Apothecary Grimoire handoffs. It does not call Supabase, clear service workers, or touch other origins. The page reloads after clearing stale in-memory state.

A signed-in local-cache clear is intentionally unavailable: existing storage does not reliably distinguish rebuildable cloud caches from unsynchronized local drafts. Offering it would risk data loss. Download a complete backup instead.

## Account deletion

Browser code cannot delete Auth users and never receives a service-role credential. `supabase/functions/delete-account/index.ts` is a deployable, disabled-by-default Edge Function architecture. The Account & Data danger control remains disabled until operators deploy, schema-review, and manually verify it.

The function rejects unknown origins, requires a bearer session, resolves the user from that session server-side, deletes current-user rows in dependency order, removes files under the user's Storage prefix, and deletes the Auth user last. It returns partial stage information without personal content and is retry-safe before Auth deletion. Environment variables are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optional comma-separated `ACCOUNT_DELETE_ALLOWED_ORIGINS`; secrets belong only in Edge Function secrets.

Before enabling frontend deletion, require a fresh complete backup, recent authentication, and exact phrase `DELETE MY SALT AND SOVEREIGNTY ACCOUNT`. Test only with a disposable development account. Verify every table/column and bucket independently in development and production. If a stage fails, do not report completion or clear local caches; retry or restore from the downloaded backup.

## Community deletion policy

Draft, pending, rejected, and other non-public submissions owned by the deleting user are deleted. Approved or published public submissions remain but are anonymized by removing account ownership/display attribution. User-owned messages are deleted; minimal moderator audit records not owned by the user may remain according to operational policy. This policy is enforced server-side and must be reviewed against published privacy terms before deployment.

## Error and accessibility behavior

Known Supabase errors map to calm messages for invalid credentials, confirmation, expired/invalid recovery links, weak/unchanged passwords, duplicate email, rate limits, ended sessions, and network failure. Technical logs contain only a coarse error code/stage, never passwords, tokens, or exported content. Forms have native labels, correct email/password autocomplete, live status regions, disabled submit states, wrapping account values, and touch-friendly shared buttons.

## Manual verification and limitations

Verify password recovery and redirects on each supported deployment, reset with fresh/expired links, password updates for email identities, Google-only messaging, email confirmation, per-user sync state, offline state, backup-gated guest clearing, sign-out state reset, and all Account & Data layouts at 320, 375, 430, and 768 pixels. Account deletion remains unavailable until the Edge Function, storage paths, table inventory, CORS origins, retention policy, and recent-auth flow are deployed and tested. Automatic guest transfer and unsafe local-cache clearing remain out of scope; explicit migration is documented below.

## Guest-to-account migration

Signing in never transfers local guest work. If allow-listed guest data remains, Account & Data offers an explicit preview, category selection, version 1 safety backup, keep-cloud conflict plan, staged RLS-protected inserts, verification, and retry checkpoints. Guest data remains after success; selective cleanup is intentionally unavailable. See [guest-to-account-migration.md](guest-to-account-migration.md).
