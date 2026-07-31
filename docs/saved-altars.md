# Saved Altars

See [Saved Altar modes](altar-save-modes.md) for active record identity, create/update behavior, same-name records, persistence, errors, and manual checks.

## My Altars library

Favorite state belongs to the saved record ID. Guest records store `favorite` in the existing local saved-Altar object; signed-in records store it inside the existing `saved_altars.altar_data` JSON payload. No SQL migration is required. Missing values default to `false`. Complete backups, merge restore, and guest-to-account migration carry this field through their existing saved-Altar paths.

Library Duplicate calls the same canonical saved-Altar create service and fresh-duplicate planner used by the Altar save workflow. A New View keeps living-object identities. A Fresh Altar remaps placement, group, and object-instance identities and clears source histories. The source row is never updated.

## Future Share privacy boundary

Share is intentionally disabled and has no click handler, URL generation, clipboard action, database write, or public payload. A future implementation must require explicit review and consent immediately before publication. Its sanitized visual payload must exclude internal record IDs where unnecessary, object-instance IDs, object edit history, undo/redo history, private notes, ritual and Grimoire links, candle burn and timing history, Apothecary inventory and private item data, user account identifiers, storage paths, Supabase user IDs, guest identifiers, hidden object metadata, and every field not required to reconstruct the intentionally shared visual Altar.
