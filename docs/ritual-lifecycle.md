# Ritual lifecycle architecture

## Audit findings

The application already had the correct major cloud records, but the workflow was distributed across wrappers:

- `ritual_templates` and `ritual_template_steps` own reusable plans.
- `ritual_sessions` and `ritual_session_steps` own a signed-in performance and step history.
- A single local pointer, `saltAndSovereigntyActiveRitualSession`, restored the active cloud session.
- `user_rituals` owns the post-session written record and links to one `grimoire_pages` page through `grimoire_page_id`.
- `ritual_links` connects that written record to canonical Living Library entities, object instances, Apothecary items, saved Altars, and its Grimoire page.
- `ritual-automation.js` wraps session start/step completion to load a linked Altar and run supported actions. It reuses the normal Altar state rather than maintaining a ritual layout.
- `ritual-journal.js` wraps completion to open reflection UI and create the Book of Shadows page.
- `my-rituals.js` is a legacy/manual journal-entry interface backed by the same `user_rituals` table and a guest local key, `saltAndSovereigntyUserRituals`. It is not a template or session list; its UI is now labeled **Ritual Journal Entries**.

The main gaps were: sessions were sign-in-only, active local state was only a pointer, template snapshots were implicit in copied step rows rather than explicit metadata, event appends were not deterministically deduplicated, template references counted as actual ritual use in Living Connections, and there was no independently testable lifecycle contract.

## Canonical records and ID flow

1. A **Ritual Template** is reusable. Its ID is copied to `ritual_sessions.template_id`; the template is never marked complete.
2. A **Ritual Session** receives a new ID for every start. It stores an immutable template snapshot, its own copied step IDs/state, Altar snapshots, meaningful events, reflection, and completion state.
3. A **Ritual Journal** is one editable `user_rituals` record per session and one linked Book of Shadows page. Its ID and page ID are never used as the session ID.
4. **Ritual Events** live in the session `event_log` and use the session ID plus stable idempotency keys for one-time actions.
5. **Living Library links** retain canonical entity IDs. A template inclusion is a reference (`countsAsUse: false`); an actual ritual record is usage.

```text
template.id
  -> session.template_id
  -> session.metadata.templateSnapshot

session.id
  -> session steps / event log
  -> user_rituals.session_id
  -> ritual journal page metadata.sessionId
  -> Journey/Search destination
  -> ritual_links via user_rituals.id
```

`js/ritual-lifecycle.js` is a small domain layer shared by browser code and tests. It snapshots templates, creates unique sessions and step IDs, appends idempotent events, completes once, saves reflection without changing history, upserts one journal per session, chooses the newest hydration record, and provides scope-separated local repositories.

## Lifecycle behavior

### Begin and resume

Starting a template copies its title, intention, links, suggestions, steps, actions, and metadata into the session. Cloud sessions continue using the established tables; their explicit template snapshot is stored in `ritual_sessions.metadata.templateSnapshot`. Guest sessions use `saltAndSovereigntyRitualLifecycle:guest`. Only one active session per scope is supported. An existing active pointer resumes that session rather than overwriting it; users must end the active session before beginning another.

### Prepare the Altar

The system continues to use `createAltarSnapshot`, `restoreAltarData`, the linked `saved_altars` record, and normal Cabinet/Apothecary placement. It does not clear the current Altar or create ritual-only objects. Session snapshots preserve canonical `entityId`, `instanceId`, and `apothecaryItemId` values when present. Loading a linked saved Altar remains an explicit property of a template and uses the shared restore path.

### Steps and events

Session steps are copies, so template edits cannot rewrite active or completed history. Completing or skipping a step changes only its session row/local snapshot. `step_completed`, `step_skipped`, and `session_completed` have stable idempotency keys. Pause/resume remain supported and meaningful events—not rerenders—are recorded.

### Completion, reflection, and journal

Completion is guarded in the UI and domain layer. A second completion returns the original completion timestamp and does not append another completion event. The active pointer is cleared only after persistence succeeds. A failed cloud update leaves the active local pointer available for retry.

The reflection form upserts `user_rituals` by `user_id + session_id`; an existing `grimoire_page_id` is reused. New pages use the existing Book of Shadows book/section/page/block APIs and store session/template IDs in page metadata. Editing a journal never mutates session events. Guest reflection and journal records use the scoped lifecycle repository and the compatible local `user_rituals` cache; a guest Book of Shadows page cannot yet be created because the current Grimoire page store is cloud-only.

### Journey, Connections, and Search

- My Journey continues to derive one ritual event from deduplicated ritual records and uses the connected Grimoire page when available.
- Living Connections counts real ritual records as use and now marks template inclusion as a non-use template reference.
- Search keeps templates separate from ritual journals and now exposes the exact active session ID as an active-session result. Completed journal results open their exact Grimoire page.

## Deletion rules

- Deleting a template does not delete sessions or journals; their snapshot/title remains readable.
- Deleting a session does not delete its template or journal. The local repository implements this independently.
- Deleting a journal does not delete its session. A replacement can be created later.
- Existing signed-in delete operations remain user-scoped. Database foreign keys must use `RESTRICT` or `SET NULL`, not cascading deletion from templates/pages into session history.
- No destructive legacy migration or automatic deletion is performed.

## Persistence and error behavior

Guest lifecycle state is isolated under the `guest` scope and survives refresh. Signed-in sessions remain owned and filtered by `user_id` in Supabase. Local and cloud records should be reconciled by `updated_at`; newer local edits win over stale hydration. Guest-to-account migration is intentionally pending.

Visible handlers retain drafts/pointers on failures, show a restrained status/toast, and log technical errors without credentials. Cloud authorization remains RLS—not frontend checks. A sign-out cannot load a cloud session because every query requires the authenticated user ID.

## Production schema checklist

- [ ] `ritual_templates.id` and `ritual_sessions.id` are independent UUID primary keys.
- [ ] `ritual_sessions.template_id` is nullable and deletion of a template is `SET NULL` or `RESTRICT`, never destructive cascade.
- [ ] `ritual_sessions` has `metadata jsonb`, `event_log jsonb`, `altar_snapshot jsonb`, status/start/end timestamps, and user ownership RLS.
- [ ] `ritual_session_steps` has its own ID, `session_id`, optional `template_step_id`, copied content/state, and user ownership RLS.
- [ ] `user_rituals.session_id` is nullable and unique per user when present.
- [ ] `ritual_links` rejects duplicate identity links and enforces user ownership.
- [ ] Grimoire tables retain user ownership RLS and ritual page metadata.
- [ ] Development and production schemas/policies are compared before release.

The optional, non-destructive indexes in `docs/ritual-lifecycle-migration.sql` should be reviewed against both projects and duplicate rows audited before execution. No production migration is run by this repository.

## Known limitations and manual verification

- Guest templates still originate from the existing template editor, which is cloud-backed; free and already-available template sessions can persist locally.
- Guest ritual journals persist locally but do not create editable guest Grimoire pages until the Book of Shadows gains a canonical local page repository.
- Cloud hydration still supports one active session at a time. Cross-device conflict resolution relies on server timestamps and requires live testing.
- Deleting completed cloud sessions has no new UI in this pass; existing records are preserved.

Manually verify template reuse, two distinct session IDs, refresh/resume, step completion, linked Altar preparation, completion retry, reflection resave, exact journal/Search destinations, Journey deduplication, Living Connections counts, guest refresh isolation, signed-in cross-device hydration, sign-out isolation, and 320/375/430/768px layouts.
