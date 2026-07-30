# User-data inventory for deletion readiness

This inventory is derived from runtime table calls and backup section definitions. It is **not** a substitute for inspecting the deployed development schema, foreign keys, RLS policies, and Storage policies. Any row marked unverified blocks account deletion.

| Table | Ownership / key | Dependencies and deletion order | Retention/shared risk | Storage / verification |
|---|---|---|---|---|
| `user_settings` | direct `user_id`; one row expected | delete last among database rows | personal only | no Storage; unique/cascade unverified |
| `saved_altars` | direct `user_id`; `id` | references entity/object/apothecary IDs inside snapshots; delete after referenced histories | personal snapshot; never delete referenced canonical/shared entities | embedded/upload URLs may point to `user-assets` |
| `custom_altar_backgrounds` | direct `user_id`; `id` | custom image override dependency unverified | personal | `user-assets/<user-id>/...` observed |
| `custom_cabinet_items` | direct `user_id`; `id` | may reference `living_library_entries.entity_id` | personal; same-name items remain distinct | optional user asset |
| `custom_cabinet_image_overrides` | direct `user_id`; key/PK schema unverified | delete before custom Cabinet/background parent records | personal | `user-assets` path retained in row |
| `grimoire_books` | direct `user_id`; `id` | parent of sections | personal | none |
| `grimoire_sections` | direct `user_id`; `id`, `book_id` | parent of pages; delete after pages | personal | cascade unverified |
| `grimoire_pages` | direct `user_id`; `id`, `section_id` | parent of blocks/page links | personal except Community system is separate | cascade unverified |
| `grimoire_blocks` | direct `user_id`; `id`, `page_id` | child; delete before pages | personal writing | none |
| `grimoire_page_links` | direct `user_id`; PK unverified, page/entity refs | child; delete before pages/entities | personal relationship | none |
| `living_library_entries` | direct `user_id`; canonical key `entity_id` (row PK may differ) | referenced by relations, object instances, ritual links and snapshots | personal layers only; Traditional catalog is code/shared and must never be deleted | optional image URL |
| `library_relations` | direct `user_id`; directional endpoints | child of Library entries; delete first | personal relation; inverse edges are not equivalent | none |
| `object_instances` | direct `user_id`; `id`, `entity_id` | parent of events; references Library/Altar/Apothecary | instances remain distinct during reconciliation | none |
| `object_instance_events` | direct `user_id`; `id`, instance FK | child; delete before instances | personal history | none |
| `apothecary_items` | direct `user_id`; `id` | referenced by instances, Altars, rituals, Cabinet | authored personal record | optional `user-assets` image |
| `ritual_templates` | direct `user_id`; `id` | parent/source of template steps and sessions | personal | none |
| `ritual_template_steps` | direct `user_id`; `id`, template FK | child before template | historical dependency behavior unverified | none |
| `ritual_sessions` | direct `user_id`; `id`, optional template FK | parent of session steps; source of completed ritual | historical record | snapshots may contain asset URLs |
| `ritual_session_steps` | direct `user_id`; `id`, session FK | child before session | historical record | none |
| `user_rituals` | direct `user_id`; `id`, session/template refs | source of ritual links and canonical Library ritual view | personal reflection/history | snapshots may contain URLs |
| `ritual_links` | direct `user_id`; `id`, ritual/entity refs | child before ritual/Library records | personal Living Connection | none |
| `community_submissions` | direct `user_id` before anonymization; `id` | parent of messages | private statuses delete; approved/published retain content but remove attribution | submitted image path policy unverified |
| `community_submission_messages` | ownership and participant columns vary; submission FK | delete user-owned private correspondence only; preserve other participants and minimal audit | shared/private mixed, high risk | none |
| restore checkpoints | browser checkpoint keys; no verified cloud table | clear user-scoped local checkpoint after success | personal operational state | local only in current implementation |
| migration checkpoints | explicit local keys include user ID and digest | do not collide with reconciliation/deletion | personal operational state | local only |
| deletion requests | no table found | not implemented | unknown | blocker if later introduced |

## Storage inventory

Runtime uploads use bucket `user-assets`, with paths beginning with the authenticated user ID. Custom Cabinet images and Altar backgrounds use this convention. Built-in assets under repository `assets/` are shared static files and are never deletion candidates. The Edge Function preview lists only `user-assets/<authenticated-user-id>/` with pagination. Other buckets, legacy paths without a user-ID prefix, signed URLs, and community-upload retention remain blockers until verified in the development dashboard.

## RLS and schema unknowns

Browser reads and writes consistently scope direct tables with `user_id`, and the Edge Function resolves the user from its bearer JWT. Exact FK actions, row primary keys, inherited ownership, message ownership columns, community image paths, bucket policies, and whether every listed table exists in both projects must be verified from `pg_constraint`, `pg_policies`, `storage.objects`, and deployed migrations. Production execution remains disabled until this inventory is signed off against development and then production.

## Conceptual deletion order

After verification: operational checkpoints; private community children; ritual links/steps/sessions/templates/rituals in verified FK order; object events then instances; Library relations; Apothecary; Living Library personal rows; Grimoire links/blocks/pages/sections/books; custom image overrides/items/backgrounds; saved Altars; settings; user-prefixed Storage objects; Auth user last. Public Community rows are anonymized server-side rather than deleted. No order is executable until FK inspection confirms it.
