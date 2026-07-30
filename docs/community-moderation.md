# Community moderation and account deletion

Moderation authorization remains server-side through RLS; frontend moderator IDs are presentation only. Account deletion must not grant the browser elevated access or let it choose another user ID.

For deletion, private drafts and non-public submissions owned by the account are removed. Approved or published public work remains only in anonymized form: account ownership and display attribution are removed. User-owned messages are removed. Minimal moderator audit records may remain when operationally necessary, but must not retain avoidable personal writing or attribution. Operators must align this policy with published terms and validate the Edge Function against actual development and production schemas before enabling deletion.

## Verified deletion readiness policy

Account deletion preview separately counts private/non-public submissions that would be deleted and approved/published submissions that would be retained only after server-side anonymization. Retained public rows must lose user ID, email/profile attribution, private metadata, and display attribution; a neutral label such as **Former Community Member** or **Anonymous Contributor** replaces it. Messages owned by other participants are never deleted merely because they reference the departing user. Exact message ownership/audit columns and public asset retention remain schema blockers, so execution is disabled until development verification.
