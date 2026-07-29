# Ritual legacy retirement

## Canonical destinations

Completed ritual writing is owned by `user_rituals` and represented by deterministic Living Library entity `ritual:<ritual-id>` under **My Practice → Rituals**. Reusable templates use `ritual-template:<template-id>` under **My Practice → Templates**. Sessions, templates, and ritual records remain separate identities.

The former Book of Shadows `Ritual Journal` section and `ritual_journal` pages are retired. New completion saves no longer create books, sections, pages, blocks, or Grimoire page links. Search excludes legacy pages and canonical results target exact Living Library records.

## Cleanup and rollback

Guest cleanup in **Account & Data** requires `DELETE MY RITUAL TEST DATA`. It removes only explicit ritual storage keys plus ritual/template Library entities and their direct relations. Apothecary items, Altars, Cabinet content, and unrelated writing are preserved.

Cloud cleanup is deliberately manual. Download a backup, then review `cleanup-current-user-ritual-test-data.sql` in development. It requires a target UUID, previews counts, scopes deletion to that UUID, and defaults to `ROLLBACK`. Confirm actual schema names independently in development and production before changing to `COMMIT`.

## Duplicate audit

`RitualLegacyCleanup.auditDuplicates()` is non-destructive. Shared ritual/template, Apothecary, traditional, or canonical source IDs are safe duplicate evidence. Matching normalized type and name without stable source identity is only probable and requires review. It never merges or deletes.

## Backup validation

Backup v1 validation is schema-aware. Restorable table rows require unique IDs; nested ingredient, altar, ritual, and Living Object snapshots are value objects whose optional helper IDs may be blank or repeated. Security scanning, ownership stripping, digest verification, limits, and top-level duplicate checks remain mandatory.

## Known limitations

Cloud cleanup is operator-run rather than automatic. Existing legacy pages remain readable until deliberate cleanup but are excluded from search. Non-ritual duplicate reconciliation remains a later, human-reviewed task.
