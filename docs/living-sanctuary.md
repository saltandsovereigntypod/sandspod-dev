# The Living Sanctuary

The Sanctuary remains inside the existing shared account panel. `LivingSanctuary` derives its home cards from the in-memory `SanctuarySearch` index and resolves entity destinations through `Library.resolveCanonicalEntityId`. It does not persist a second recent-items list.

`MyJourney` normalizes the same already-loaded records into a read-only chronicle. It provides deterministic deduplication, ordering, grouping, filtering, milestones, and restrained summaries. Journey search reuses `SanctuarySearch.rankRecords`; no timeline or analytics table is introduced.

Settings retain the existing local-first and Supabase save path. `LivingSettingsView` organizes the existing controls into keyboard-accessible categories without changing their persistence keys. Altar background options are derived from loaded cabinet definitions and preserve an unknown saved value until definitions become available.

The home and chronicle render from local in-memory sources immediately. Source hydration can update the existing search index; derived views remain user-scoped and are cleared when authentication changes.

## Version 1.4.1 regression findings

- The duplicate `Sanctuary` label in the Book of Shadows was caused by the installer rewriting the text of every `data-my-sanctuary-open` element, including the launcher whose explicit destination is My Journey. Only unscoped Sanctuary launchers are now normalized.
- Community and submission pages loaded the original shared panel scripts but omitted the Living Sanctuary enhancement scripts, leaving their older visible wording and dashboard presentation in place.
- Settings attempted to read `window.cabinetItems`, but the cabinet catalogue is a top-level lexical `const`, not a `window` property. A narrow `AltarBackgrounds.getAll()` accessor and readiness event now expose only supported background definitions.
- Community moderation remained in the old Settings footer, so replacing the dashboard markup removed it from first-class navigation. The Sanctuary home now reuses the existing admin identity check and existing `/admin/submissions/` destination; server-side/RLS protections remain authoritative.

The Sanctuary Snapshot is computed from the currently loaded altar object state and active Ritual Session. A Living Connection observation is shown only when two structured records in different source groups share the same canonical entity. Neither result is persisted.

## Version 1.4.2 regression findings

- Sanctuary Home rendered once during script installation, before asynchronous authentication resolved. Although `my-sanctuary.js` updated its older markup on `saltAuthChanged`, the Living Sanctuary replacement did not rerender. It now refreshes the visible Home on both `saltAuthChanged` and `saltAuthReady` using the same moderator helper as the moderation page.
- Background metadata lived in the Altar-only cabinet module, so Settings opened from the homepage or Community pages had no definitions. `SanctuaryAssetCatalog` is now loaded before Settings on every Sanctuary-capable page.
- Search results had `overflow-y: auto`, but the dialog grid did not allocate a bounded `minmax(0, 1fr)` results row. The results region now owns the remaining viewport height and the body is locked only while search is open.
- Apothecary persistence uses `name` as the authored display name and `typeLabel` as the human-readable form. Search opened before asynchronous Apothecary hydration and was not notified afterward, making the cabinet/type match appear while the authored item was absent. Hydration, save, rename, and deletion now announce the existing source-change event, and one shared adapter indexes both fields.

## Version 1.4.3 state repair

The remaining greeting, moderation-link, and dual-auth-action regressions shared one cause: Living Sanctuary rendered from local defaults and independently inferred auth state before cloud auth/settings hydration. It now maintains one request-guarded view state containing resolved auth, current user, guest status, hydrated settings, settings readiness, and the shared moderation decision. Auth and Settings events update that state and rerender only the visible Home. Auth actions are emitted mutually exclusively rather than relying on `hidden` attributes that could be overridden by button layout CSS.

Search navigation previously mixed ordinary anchors with action-only buttons. Apothecary and Cabinet results could therefore navigate to a generic `/altar/` URL, allowing working-draft restoration to become the only visible action. `SanctuarySearchNavigation` now captures an explicit destination before closing Search, dispatches same-page actions directly, and preserves deep-link parameters for cross-page Altar actions. Altar restoration suppresses its generic toast when a specific destination is present, then opens the requested Cabinet category, Apothecary item, template, or object instance.

## Version 1.4.4 runtime correction

The moderation page awaited its lexical auth user and evaluated the shared allow-list directly, while Sanctuary could recompute its derived permission before that same helper/user pair was ready and later overwrite the result during settings hydration. `getSaltCommunityModeratorState()` now owns the resolved user and permission decision for both surfaces. Its `saltModeratorStateReady` event is emitted when the helper loads and whenever auth changes; Sanctuary applies that decision without replacing hydrated settings or the current subview.

Cabinet and Apothecary search destinations now describe placement rather than generic opening. On the Altar they delegate to the existing cabinet and Apothecary placement paths; off the Altar they preserve stable IDs in one-time query actions. Successfully consumed actions are removed with `history.replaceState`, preventing refresh from placing a duplicate. Current Altar results remain selection-only.

## Version 1.4.5 runtime findings

The moderation page read `getSaltCommunityModeratorState()` at the moment it guarded the queue, while Sanctuary rendered from a previously derived `sanctuaryState.canModerate`. That cached value could remain false even though the shared auth state had subsequently resolved. Home rendering and initial installation now reconcile from the authoritative moderator state at render time as well as on readiness events. A safe `?debugSanctuary=1` diagnostic compares only user IDs, helper availability, and boolean decisions; it exposes no email, token, session, or metadata.

Existing Apothecary records were absent because the cache was hydrated only when the Apothecary overlay opened. Search therefore indexed an empty startup cache, while create/edit paths happened to populate it and emit a refresh. Search enrichment now requests the existing hydration function, all persisted shapes pass through `ApothecaryNormalization`, and a revision guard prevents an older local or cloud response from replacing a newer cache. Completion emits `apothecary:hydrated` for local, cloud, empty, and error-complete outcomes.
