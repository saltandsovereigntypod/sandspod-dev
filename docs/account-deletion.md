# Secure account-deletion readiness

## Current status: execution disabled

The Edge Function now supports authenticated `capability` and write-free `preview` actions. Its `execute` action fails closed with `account_deletion_not_verified`. Production is always disabled in source. There is no server-verifiable recent-authentication challenge or signed backup challenge yet, and no disposable development account run has been completed from this repository environment.

## Safety flow

The required final flow is authenticated JWT → server-verified recent authentication → fresh Complete Backup gate → write-free preview → exact confirmation → dependency-safe server stages → user-prefixed Storage cleanup → Auth deletion last. The browser never sends a user ID as deletion authority and never receives the service-role secret.

The local backup gate helper binds user ID, backup integrity digest, data snapshot digest, creation time, and a 20-minute expiry. It is testable but deliberately not accepted by `execute`: a server challenge store or signed server nonce is still required to prove freshness without trusting browser state.

## Preview

`preview` resolves the user from `auth.getUser()`, counts configured tables with `user_id`, paginates the `user-assets/<user-id>/` prefix, and returns counts, blockers, expiry, warnings, and a digest—never personal row content or filenames. Missing tables/policies become blockers. Community counts distinguish private rows that would be deleted from approved/published rows that would be anonymized.

## Recent authentication

Supabase browser session presence is not evidence of recent reauthentication. Email/password users could reauthenticate with `signInWithPassword`; Google-only users must use a fresh Google OAuth flow and must never be asked for a nonexistent password. The deployed function currently lacks a server-verifiable reauthentication timestamp/challenge, so `recentAuthVerified` is hard false and execution remains disabled.

## Development deployment

1. Install/login to the Supabase CLI without committing credentials.
2. Select the **development** project: `supabase link --project-ref <development-project-ref>`.
3. Set Edge Function secrets with `supabase secrets set ACCOUNT_DELETE_ENVIRONMENT=development ACCOUNT_DELETE_ALLOWED_ORIGINS=https://dev.saltandsovereignty.com SUPABASE_URL=<value> SUPABASE_ANON_KEY=<value> SUPABASE_SERVICE_ROLE_KEY=<value>`.
4. Keep all readiness flags false until independently verified. Deploy preview with `supabase functions deploy delete-account --no-verify-jwt` (the function performs bearer verification itself).
5. Inspect safe logs with `supabase functions logs delete-account`; logs must never contain tokens or personal content.
6. Verify preview counts and origin/session rejection with two synthetic development users.
7. Verify schema/FKs, `user-assets` paths, Community policy, a server recent-auth challenge, backup challenge, partial retries, another-user isolation, Storage removal, and Auth-last deletion.
8. Only after the disposable-account checklist passes may development readiness flags be set. Source still requires implementation of verified execution before it can run.

Disable or roll back with `supabase functions delete delete-account --project-ref <development-project-ref>` or redeploy this fail-closed revision. Never copy development secrets or flags to production. Production requires a separate link, origin allow-list, inventory review, and approval after all readiness items pass.

## Disposable-account checklist

Create two synthetic development users. For the deletion candidate create one setting, saved Altar, custom Cabinet item, Grimoire page/block, Library entry/relation, object instance/event, Apothecary item, ritual template/session/completion, private Community draft, approved synthetic submission, and `user-assets/<candidate-id>/synthetic-test.png`. Confirm preview counts, private deletion, published anonymization to **Former Community Member** or **Anonymous Contributor**, Storage deletion, Auth deletion last, failed login afterward, and complete survival of the second user. Never use owner/moderator or production accounts.
