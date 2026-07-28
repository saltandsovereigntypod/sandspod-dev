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
