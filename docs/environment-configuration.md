# Environment and deployment configuration

The accessibility loader is environment-independent and reads only explicit browser keys. It does not select Supabase projects, import environment configuration, or delay environment/auth initialization. Guest preferences apply before content paint where the shared head script is present; authenticated device preferences reconcile after the existing auth-ready event.

## Why this exists

Shared source is deployed unchanged to development and production. `js/environment.js` is the single authority for choosing a deployment; `js/supabase-config.js` only creates one client from that decision. This prevents a merge from silently moving development users, data, storage, OAuth returns, or moderator presentation into production.

The pre-stabilization audit found a development Supabase URL and publishable key directly in `js/supabase-config.js`, an origin-only OAuth return, production moderator UUIDs in `js/auth.js`, `/sandspod/` PWA paths, a production `CNAME`, and no registered service worker. Relative HTML assets generally worked, but root application links did not preserve the GitHub Pages repository prefix. Password recovery and email-change redirects are now environment-aware. Magic-link authentication and service-worker registration remain intentionally absent.

## Supported deployments

| Deployment | Host/path | Base path | Supabase project | Moderator presentation IDs |
| --- | --- | --- | --- | --- |
| Production | `saltandsovereignty.com` or intentional `www` alias | `/` | `outksqvhusvvtjgiveoh` | the two production project UUIDs in the environment module |
| Development custom domain | `dev.saltandsovereignty.com` | `/` | `aiiqyesczxrrujznwoke` | the development project UUID |
| Development GitHub Pages | `saltandsovereigntypod.github.io/sandspod-dev/` | `/sandspod-dev/` | `aiiqyesczxrrujznwoke` | the development project UUID |
| Local | `localhost` or `127.0.0.1` | `/` | `aiiqyesczxrrujznwoke` | the development project UUID |

Unknown public hosts are unrecognized and Supabase/OAuth fail closed. Add a host only in the environment resolver, add deterministic tests, update dashboard allow-lists, and run both validation modes.

## Browser-key handling

Only a Supabase browser-safe publishable key (or a verified legacy anon key) belongs in static source. **Never commit a service-role key, secret key, database password, OAuth client secret, storage credential, access token, refresh token, or session.** The tracked development value is a publishable key. A production browser key was not present in tracked history, so production intentionally refuses to initialize until the empty production `publishableKey` in `js/environment.js` is populated with the browser-safe value copied from the **production** project's API settings. Do not reuse the development value and do not fabricate a JWT.

Browser UUID checks only control presentation. Production RLS and policies must authorize all moderation operations. Migrate this temporary allow-list to an RLS-protected moderator membership table, roles, or server-authoritative custom claims.

## Auth dashboard actions

In development project `aiiqyesczxrrujznwoke`, set Site URL to `https://dev.saltandsovereignty.com/` and intentionally allow:

- `https://dev.saltandsovereignty.com/`
- `https://dev.saltandsovereignty.com/**`
- `https://saltandsovereigntypod.github.io/sandspod-dev/`
- `https://saltandsovereigntypod.github.io/sandspod-dev/**`
- `http://localhost:5500/**`
- `http://127.0.0.1:5500/**`

In production project `outksqvhusvvtjgiveoh`, set Site URL to `https://saltandsovereignty.com/` and allow only:

- `https://saltandsovereignty.com/`
- `https://saltandsovereignty.com/**`

Add `https://www.saltandsovereignty.com/` and its `/**` form only when that alias is intentionally deployed. Do not add development hosts to production Auth. Ensure Google is enabled and its provider callback is configured in each project. Local OAuth works only after its exact URL is allowed. Email/password signup currently relies on the project's Site URL because the application supplies no `emailRedirectTo`.

## Paths, manifest, service worker, and deployment

`resolvePath()` maps application-root paths to the deployment base, and `oauthReturnUrl()` combines that base with the active origin. A central navigation guard preserves `/sandspod-dev/` for root-style links generated throughout the application. Static nested-page assets remain relative.

The Altar manifest uses URLs relative to the manifest itself (`./` scope/start and `../assets` icons), so one static file works under both custom-domain root and GitHub Pages. The service worker is **not registered** and remains dormant. Its stale/nonexistent precache list was replaced with relative, existing files; its future cache identity includes host environment, scope/base path, and version. It uses network-first behavior and never intercepts environment or Supabase configuration requests. Do not register it without a separate PWA rollout and browser testing.

On pushes to development `main`, validation runs first. The sync workflow mirrors shared source to the production repository's `dev` branch, excluding `.git` and `.github`, then generates the development `CNAME` only in that checkout. It never writes generated CNAME/configuration back to shared source. A later merge to production uses the same source; hostname selection means no Supabase URL or OAuth rewrite is required.

Run:

```sh
npm test
npm run validate:dev
npm run validate:production
```

Use `?debugEnvironment=1`, then call `debugSaltEnvironment()` in the console. It reports only deployment name, host, base path, project ref, OAuth return, recognition, and assertion status—never keys, users, sessions, or tokens.

## Production schema and storage compatibility checklist

Static source can identify expectations but cannot verify either remote project without privileged dashboard/database access. Before production activation, compare both projects and mark every item complete:

- [ ] Auth: email/password and Google provider settings, redirect allow-lists, templates, and user lifecycle behavior.
- [ ] Tables/columns/foreign keys/indexes: `user_settings`, `user_rituals`, `saved_altars`, `apothecary_items`, `custom_cabinet_items`, `custom_cabinet_image_overrides`, `custom_altar_backgrounds`.
- [ ] Living Library: its canonical entity and relation tables used by the sync layer; preserve the existing architecture.
- [ ] Book of Shadows: `grimoire_books`, `grimoire_sections`, `grimoire_pages`, `grimoire_blocks`, and `grimoire_page_links`.
- [ ] Rituals: `ritual_templates`, `ritual_template_steps`, `ritual_sessions`, `ritual_session_steps`, and `ritual_links`.
- [ ] Ritual lifecycle retry constraints from `docs/ritual-lifecycle-migration.sql` are reviewed in development, duplicate rows are audited, and equivalent production indexes are applied deliberately.
- [ ] Backup table ownership, RLS, pagination, restore ordering, and Storage CORS are verified using `docs/sanctuary-backup-and-restore.md`; development and production are audited independently.
- [ ] Living object instance/event tables used by `js/object-instances.js`.
- [ ] Community: `community_submissions` and `community_submission_messages`, including moderator-only policies.
- [ ] Storage buckets: `user-assets` and `living-library-images`, including size/type rules and ownership policies.
- [ ] All RLS enablement and CRUD policies enforce `auth.uid()` ownership; moderator operations are server-authorized rather than trusting frontend UUIDs.
- [ ] Functions, triggers, grants, storage policies, and required extensions match between projects.

Any unchecked resource is a production blocker. Project URL selection does not synchronize schemas. Perform no destructive migration from the static-site deployment workflow.

## Merge, verification, rollback

Before merging, obtain and verify the production browser key, run all tests, review both dashboard redirect lists, complete the compatibility checklist, and verify dev custom-domain and GitHub Pages login/data/storage. After merging, use the safe diagnostic on production, test Google and email/password login, moderator presentation, Community Submissions, Altar, Book of Shadows, Apothecary, settings, uploads, and confirm no development records appear.

For rollback, revert the stabilization commit and redeploy only if the previous configuration is known safe for the target host. Prefer reverting the deployment while preserving the fail-closed production guard; never “fix” an incident by inserting the development key into production. Revoke/rotate any credential immediately if a privileged value was ever exposed, then audit Supabase logs and sessions.

## Password recovery and email-change redirects

Account recovery uses the environment resolver rather than hard-coded origins. Configure these exact reset destinations in the matching project:

| Deployment | Site URL | Required reset/email redirect |
| --- | --- | --- |
| Production | `https://saltandsovereignty.com/` | `https://saltandsovereignty.com/account/reset-password/` |
| Production `www` (only when deployed) | production apex remains preferred | `https://www.saltandsovereignty.com/account/reset-password/` |
| Development custom domain | `https://dev.saltandsovereignty.com/` | `https://dev.saltandsovereignty.com/account/reset-password/` |
| Development GitHub Pages | development Site URL remains the custom domain | `https://saltandsovereigntypod.github.io/sandspod-dev/account/reset-password/` |
| Local port 5500 | development project only | `http://localhost:5500/account/reset-password/` and `http://127.0.0.1:5500/account/reset-password/` |

Allow the matching root URL as well for OAuth and email-change confirmation. Never add development URLs to the production project. Supabase's Google callback remains the project's `/auth/v1/callback`; the application's `redirectTo` returns to the deployment-aware root. Unknown hosts remain fail-closed and cannot compose recovery or OAuth returns.

## Guest migration environment behavior

Guest migration uses the already-selected browser Supabase client, so development guest records can migrate only into the authenticated development project and production records only into production. It contains no project URL, publishable key, auth token, moderator state, or ownership value from guest storage. Unknown hosts remain fail-closed. Development and production table/RLS/storage compatibility must be reviewed independently before live migration testing.

## Account deletion deployment flags

The Edge Function requires `ACCOUNT_DELETE_ENVIRONMENT=development` for readiness work and separate `ACCOUNT_DELETE_ALLOWED_ORIGINS`. Inventory, Storage, Community policy, and disposable-test flags default false; source keeps recent-auth verification and production execution false regardless of query strings or browser storage. Development and production projects must be linked, reviewed, and deployed independently. See `docs/account-deletion.md` for CLI steps and rollback.
