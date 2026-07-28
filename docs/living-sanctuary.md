# The Living Sanctuary

The Sanctuary remains inside the existing shared account panel. `LivingSanctuary` derives its home cards from the in-memory `SanctuarySearch` index and resolves entity destinations through `Library.resolveCanonicalEntityId`. It does not persist a second recent-items list.

`MyJourney` normalizes the same already-loaded records into a read-only chronicle. It provides deterministic deduplication, ordering, grouping, filtering, milestones, and restrained summaries. Journey search reuses `SanctuarySearch.rankRecords`; no timeline or analytics table is introduced.

Settings retain the existing local-first and Supabase save path. `LivingSettingsView` organizes the existing controls into keyboard-accessible categories without changing their persistence keys. Altar background options are derived from loaded cabinet definitions and preserve an unknown saved value until definitions become available.

The home and chronicle render from local in-memory sources immediately. Source hydration can update the existing search index; derived views remain user-scoped and are cleared when authentication changes.
