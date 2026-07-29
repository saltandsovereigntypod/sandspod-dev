# Community moderation and account deletion

Moderation authorization remains server-side through RLS; frontend moderator IDs are presentation only. Account deletion must not grant the browser elevated access or let it choose another user ID.

For deletion, private drafts and non-public submissions owned by the account are removed. Approved or published public work remains only in anonymized form: account ownership and display attribution are removed. User-owned messages are removed. Minimal moderator audit records may remain when operationally necessary, but must not retain avoidable personal writing or attribution. Operators must align this policy with published terms and validate the Edge Function against actual development and production schemas before enabling deletion.
