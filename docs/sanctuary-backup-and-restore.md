# Sanctuary backup and restore

> Backup v1 validation now requires IDs only for restorable collection rows. Nested snapshot helper IDs may be blank or repeated; actual row-ID problems remain blocking and are displayed separately from warnings.


## Purpose and supported scopes

Sanctuary backups are user-controlled JSON snapshots available under **Sanctuary Settings → Account & Data**. The format identifier is `salt-and-sovereignty-sanctuary-backup`; the current schema version is `1`. Complete backups are restorable. Book of Shadows exports are structured subsets. A readable print/PDF export is not included in version 1.

- **Guest browser:** collects only an explicit allow-list of guest `localStorage` keys. It never scans arbitrary browser storage, the active authenticated-session pointer, or signed-in caches.
- **Authenticated user:** reads canonical source tables through the browser Supabase client, `user_id` filters, and RLS. Tables are paginated in 1,000-row windows. A required table failure marks the snapshot partial and prevents a misleading “complete” download.

Exports never contain passwords, access/refresh tokens, Supabase configuration, Auth sessions, OAuth data, moderator IDs/roles, service credentials, or trusted ownership fields. Imported `user_id` values are rejected; authenticated restore always supplies the currently authenticated user ID.

## Data inventory

| Area | Canonical sources | Guest source |
| --- | --- | --- |
| Identity/settings | `user_settings` | `saltAndSovereigntyUserSettings` |
| Altar | `saved_altars`, `custom_altar_backgrounds`, `custom_cabinet_items`, `custom_cabinet_image_overrides` | saved layouts, working draft, custom Cabinet key |
| Book of Shadows | `grimoire_books`, `grimoire_sections`, `grimoire_pages`, `grimoire_blocks`, `grimoire_page_links` | ritual journal cache and supported presentation preferences; the current Grimoire has no canonical guest page store |
| Living Library | `living_library_entries`, `library_relations`, `object_instances`, `object_instance_events` | Living Library and layout keys |
| Apothecary | `apothecary_items` | Apothecary key, including authored items and data URLs |
| Rituals | `ritual_templates`, `ritual_template_steps`, `ritual_sessions`, `ritual_session_steps`, `user_rituals`, `ritual_links` | ritual journals and scoped guest lifecycle repository |
| Community | the user’s `community_submissions`; messages reached only through those submission IDs | no guest community rows currently persisted |

My Journey, Sanctuary Search, and Living Connections are derived and are rebuilt from these canonical sources. Rendered timelines/result lists are not duplicated. Traditional Library content and public community content owned by others are not exported.

## Format and integrity

Each backup contains creation/environment labels, ownership-neutral scope, a sorted section manifest, per-section record counts, asset count/warnings, structured data, assets, and an SHA-256 digest. Serialization sorts object keys. The digest field is blanked during calculation. Validation recomputes it before any plan or write.

SHA-256 detects accidental file modification; it is **not** a signature and does not prove who created a file. Future versions must add a migration in the backup authority before the supported-version check changes. Version checks must not be scattered through feature modules.

## Assets

Version 1 stays dependency-free and embeds supported PNG, JPEG, and WebP assets as data URLs in JSON. Existing data URLs up to 2 MB are included. Remote image URLs are fetched without credentials where CORS permits; signed query parameters are removed from recorded source URLs. Missing, blocked, unsupported, or oversized images become manifest warnings rather than corrupting structured records. At most 100 assets are embedded, and the total JSON input limit is 25 MB. A ZIP library/build system was deliberately avoided.

## Validation and import security

No data is written during file reading, JSON parsing, validation, summary, or merge planning. Validation checks format/version/top-level structure, creation date, counts, duplicate IDs, embedded asset types/sizes, SHA-256 integrity, credential/authorization/ownership fields, and active-content patterns (`script`, `iframe`, `object`, `embed`, and `javascript:`). Parsed data is copied into null-prototype objects; `__proto__`, `prototype`, and `constructor` are forbidden. Imported code is never evaluated or inserted as HTML.

Unknown compatible fields are retained after security filtering. Stable IDs—not titles—control identity. Version 1 reports ID collisions and keeps the existing record during merge. This preserves current work and canonical identity; it does not silently overwrite by display name.

## Restore behavior

Only **Merge With Existing Sanctuary** is enabled. Replace is intentionally unavailable because a browser cannot provide a transaction across all tables and Storage.

The flow is:

```text
Choose → size check → parse → validate → integrity/count checks
→ show summary/conflicts → download current pre-restore backup
→ build plan without writes → confirm merge → staged writes → report
```

Guest arrays merge by stable ID; matching IDs keep the current record. Guest objects preserve current fields over incoming fields. Applying the same plan twice is a no-op.

Authenticated records are restored in dependency order: settings; books/sections; Living Library entities; pages/blocks; Apothecary/templates; sessions/journals; Altars/object instances; then relationship tables and the user’s community submissions. Existing IDs are queried first and kept as conflicts. New rows are assigned the current `user_id`. Moderator messages are exported for the user’s own submissions but are not restored automatically because their sender/visibility semantics require server-side authorization review.

Cloud restore is staged rather than falsely described as atomic. Completed table names are checkpointed locally using the backup digest and current user. A retry skips completed stages. On failure, restore stops before the next table and reports a recoverable retry state. No delete occurs.

## Privacy, progress, and recovery

The UI uses an `aria-live` status region for gathering, asset preparation, validation, planning, stage progress, and results. Technical failures go to the console without record/file contents. Users see calm messages without raw database details.

Before merge, the Restore button remains disabled until a fresh pre-restore backup has been downloaded. To recover from a problem, keep both files, retry the same validated backup to resume a cloud checkpoint, or restore the safety backup using merge. Never test destructive behavior in production.

## Supabase/RLS checklist

- [ ] Every exported table has `id`, `user_id`, ownership SELECT/INSERT RLS, and expected foreign keys in both projects.
- [ ] Pagination returns all owned rows and no other user’s rows.
- [ ] Restore order matches actual foreign keys; deletes do not cascade unexpectedly.
- [ ] Unique/upsert constraints are documented, especially `user_settings`, ritual journals, links, Living Library relations, and Grimoire links.
- [ ] Community-message policies allow a submitter to read only messages belonging to their own submissions.
- [ ] `user-assets` and `living-library-images` CORS/policies permit the owner’s browser to read portable images where intended.
- [ ] The optional ritual indexes in `ritual-lifecycle-migration.sql` are duplicate-audited and reviewed separately in development and production.

No migration is required by the JSON backup format. No schema or RLS change is executed by this repository.

## Known limitations and manual tests

- JSON is capped at 25 MB, individual images at 2 MB, and embedded assets at 100. Large media libraries may report omitted assets.
- Version 1 does not upload restored asset payloads back to Supabase Storage; structured records and embedded payloads remain in the backup, while cloud record image URLs may still require manual recovery.
- Cloud collision handling keeps the current record instead of remapping it. Conflicts are reported; no display-name merge occurs.
- Replace, guest-to-account migration, readable/PDF export, and guest Grimoire page restoration are not implemented.

Manually test production/guest export counts and credential absence; malformed/wrong-version/tampered files; guest merge; development authenticated staged merge; canonical entities; template/session/journal links; retry checkpoints; image CORS warnings; sign-out during export/restore; and mobile widths. Never run replace tests in production.
