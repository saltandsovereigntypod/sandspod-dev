# Saved Altar modes

The Altar now tracks the loaded saved record by ID, name, owner scope, source, and save timestamps. A blank Altar has no saved identity. Loading, creating, saving a new view, or creating a fresh duplicate assigns the resulting record as the active identity; deleting it or clearing the workspace removes that identity. Rename keeps the identity and updates its displayed name.

## Modes and identity

- **First save** asks for a name and creates one record.
- **Update Existing Save** updates that owned record by ID. It preserves its creation time and all placement, group, living-state, ritual, Apothecary, and candle identities.
- **Save as New View** creates a record with a new save ID while preserving placement and object-instance IDs. The two records are views of the same living objects.
- **Duplicate as Fresh Altar** plans an immutable copy, remaps group, placement, and instance IDs, preserves entity and Apothecary recipe references, and clears instance histories and ritual inclusion. Candles use the canonical lifecycle defaults and begin full-life, unlocked, unlit, undressed, and without burn history.

Guest records use stable UUIDs in local storage. Authenticated operations use the existing RLS-protected `saved_altars` path and verify the current user and active record before update. Names are labels, never identity, so same-name records remain distinct. Save submission is guarded; failure retains the previous context and dirty state.

The save and name dialogs use real buttons, labelled input, keyboard submission, Escape cancellation, focus entry/restoration, live validation, responsive sizing, high-contrast borders, and reduced-motion-safe behavior.

## Backup, migration, and limitations

The existing complete backup exports saved rows and object instances by ID, which retains shared-view identity and fresh-instance separation. Merge restore remains ID-based; version 1 remains readable. Guest-to-account migration continues staging each saved row by ID, including same-name views. There is no autosave history, overwrite undo, collaborative save, or replace-style restore.

Manual verification should cover first save, each of the three subsequent choices, a burning and spent candle, same-name views, update failure, keyboard focus, and widths from 320px through desktop. Cloud failure and cross-device behavior require a configured Supabase session.
