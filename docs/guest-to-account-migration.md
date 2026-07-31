# Guest-to-account migration

## Explicit scope

Migration never runs during signup, email confirmation, email/password sign-in, or Google sign-in. Choosing guest mode marks the browser guest scope; after authentication, a non-blocking Sanctuary notice and **Account & Data → Guest Sanctuary Found** entry appear only while allow-listed guest records exist. Dismissal is keyed to the current account and a fingerprint of the guest snapshot, so newly changed guest data is eligible again.

Immediately before authentication, the allow-listed guest snapshot is preserved under a dedicated migration key so later signed-in cache hydration cannot be mistaken for guest ownership. Guest-mode writes invalidate that preserved snapshot before the next sign-in.

The same workflow serves new and existing accounts. Browser presence is not proof of ownership: the signed-in user must review categories, download a safety backup, review cloud conflicts, and explicitly begin migration.

## Guest storage audit

| Guest key | Records | Cloud destination | Identity/conflict behavior | Assets and limitations |
| --- | --- | --- | --- | --- |
| `saltAndSovereigntyUserSettings` | Preferences and presentation fields | `user_settings` | Cloud row wins when it exists; no silent overwrite | No assets |
| `saltAndSovereigntySavedAltars` | Named Altar snapshots, transforms, groups, references | `saved_altars` | Valid UUID is preserved; invalid local ID receives deterministic UUID; same cloud ID is skipped | Embedded browser images are omitted and reported |
| `saltAndSovereigntyWorkingAltarDraft` | Unsaved working Altar | none in migration v1 | Unsupported; save a named Altar first | Remains local |
| `saltAndSovereigntyLibrary` | Canonical/personal entities and relations | `living_library_entries`, `library_relations` | `entity_id` remains canonical; never matched by display name; exact relation edges are skipped | Data images are not uploaded automatically |
| `saltAndSovereigntyLibraryPageLayouts` | Local presentation layout | represented with Library data where supported | No independent cloud insert in v1 | Derived/presentation data |
| `saltAndSovereigntyApothecaryItems` | Authored items, ingredients, intent, state and references | `apothecary_items` | UUID preserved/remapped; same cloud ID is kept | Browser-only image removed and reported |
| `saltAndSovereigntyUserRituals` | Completed ritual records and reflections | `user_rituals` | Ritual ID and session reference preserved/remapped; same cloud ID skipped | No legacy Ritual Journal pages created |
| `saltAndSovereigntyRitualLifecycle:guest` | Templates, steps, sessions, steps, journals when present | ritual lifecycle tables | Parent IDs map before child references; same cloud IDs skipped | Snapshots remain structured values |
| `saltAndSovereigntyCustomCabinetItems` | Custom items/forms and entity references | `custom_cabinet_items` | UUID preserved/remapped; same cloud ID skipped | Browser images omitted and reported |
| `saltAndSovereigntyMundaneMode` | Presentation preference | settings category | Migrates only with supported settings | No asset |

The allow-list is shared with backup infrastructure; no arbitrary storage scan occurs. Guest Book of Shadows pages are not independently represented by a restorable local table in the current architecture, so that category is visible but disabled and reported as unsupported. Working drafts, community content, auth/session state, moderator state, environment configuration, service-worker data, and published community records are excluded. Community ownership is never inferred from titles.

## Preview and safety backup

Preview reads and sanitizes allow-listed guest data, computes counts and a snapshot digest, reports unsupported records/assets, and performs no cloud writes. Categories can be selected or deselected. A version 1 Sanctuary guest backup must be generated and downloaded for that exact digest before plan review is enabled. Any guest change invalidates the backup gate.

The backup uses the existing `SanctuaryBackup` format, security scanner, size limits, asset collector, deterministic serialization, and SHA-256 integrity digest. Prototype keys, credential/auth fields, moderator claims, environment configuration, active content, and unsafe ownership fields are rejected or removed by the existing rules. Guest content is never evaluated or logged.

## Identity, conflicts, and dependency order

Cloud wins by default. Stable primary IDs or canonical source IDs are the only identity evidence; names and titles never merge records. Valid UUIDs are preserved. Non-UUID IDs for UUID-backed tables receive deterministic namespace-derived UUIDs, and known template/session child references are rewritten through one in-memory map. Canonical Living Library `entity_id` values are never converted to UUIDs.

Conflicts are classified as cloud-record-already-exists or exact relation match and skipped. Guest-only records are staged for insertion. Import-as-copy and destructive overwrite are intentionally absent in version 1. The order is settings, Living Library entities, ritual templates/steps/sessions/records, Apothecary, saved Altars, custom Cabinet items, then Library relations. Retired `ritual_journal` Grimoire pages are never generated.

## Staging, retry, and verification

The operation ID and checkpoint key include the authenticated user ID and guest snapshot digest. Each completed table stage is checkpointed locally. Retry skips completed stages. Every stage rechecks the current authenticated user; sign-out/account changes stop migration. A changed guest digest also stops before writes. RLS remains authoritative and every inserted row receives the current authenticated user ID rather than trusting local ownership.

A failed stage reports only the table/stage and coarse error code, leaves all guest records intact, and does not advance successful-sync time. After all non-empty stages are checkpointed, verification checks completion before marking the shared sync status successful once. Browser migration is staged, not falsely described as transactional.

## Guest cleanup

Migration defaults to **Keep Guest Copy on This Browser**. No selected, unselected, failed, or unsupported guest data is automatically removed. Selective record-level cleanup is not safe with the current shared keys, so the migration UI does not overpromise it. Users may later use the full backup-gated guest-clear control after reviewing the safety backup. That control uses an allow-list and never calls `localStorage.clear()`.

## Recovery and manual testing

On failure, keep the downloaded backup and guest copy, restore connectivity or resolve schema/RLS differences, then retry the same plan so completed stages are skipped. If the guest snapshot changed, review it and download a new safety backup. Test new-account and existing-account flows in development, stable-ID conflicts, sign-out during stages, network interruption/retry, canonical Library links, ritual history, Apothecary ingredients, saved Altar references, Search/Journey hydration, and 320/375/430/768 pixel layouts.

## Known limitations

Guest Book of Shadows table records, working Altar drafts, community data, browser-only image upload, import-as-copy, field-level settings merging, selective post-migration cleanup, and migration of independently persisted object-instance events are not supported in version 1. Unsupported data remains local and in the safety backup. Production and development schemas must be reviewed independently before enabling migration for real accounts.

## Saved Altar modes

Migration stages saved Altars by ID, so same-name views remain separate. Shared object-instance IDs remain coherent between views, while fresh duplicates remain independent. See [Saved Altar modes](altar-save-modes.md).
