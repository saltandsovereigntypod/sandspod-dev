# Living Library duplicate audit

The Account & Data **Living Library Health** scan is write-free. It reads only the authenticated user's Library entries, directional relations, object-instance references, and ritual links. It does not update sync time.

## Evidence and classifications

Strong identity is a shared RitualTemplateId, RitualId, Apothecary item ID, Traditional source ID, object-instance source ID, migration fingerprint, source-type/source-ID pair, or deterministic `ritual:*`, `ritual-template:*`, `apothecary:*`, `traditional:*`, or `cabinet-item:*` entity ID. Title/type equality is weak evidence only and is reported as **possible duplicate—kept separate**.

Strong groups are classified as exact duplicate when comparable authored layers match, canonical identity collision when source identity matches and compatible fields can be preserved, or manual review when the same authored field conflicts. Relations are duplicate only when owner, direction, type, endpoints, and metadata are equivalent. Inverse or differently annotated relations remain distinct.

## Survivor and dependency plan

The deterministic ID wins when present. Otherwise the richest compatible authored record wins, with oldest stable identity as a final tie-breaker. The plan records the reason, retiring IDs, relation redirects, object-instance entity redirects, and ritual-link redirects. Object instances and their events never merge; only their entity reference may eventually redirect. Conflicts and dangling dependencies block execution.

The current UI intentionally has no apply control. Production and development are preview-only until the rollback-first SQL is verified, a fresh Complete Backup is bound to the plan/user/source digest, and a secure server procedure recalculates evidence and redirects dependencies transactionally.
