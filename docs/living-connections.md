# Living Connections

`js/living-connections.js` is the shared read/query layer for connections across the Sanctuary. It does not own or persist another relationship graph. Instead, it normalizes records already owned by the Living Library, object instances, Ritual Sessions and journals, Book of Shadows, ritual templates, and apothecary recipes.

## Canonical identity

Every query starts with a canonical Living Library entity ID. `LivingConnections.resolveEntityId(value)` accepts an ID or a record containing `entityId` / `entity_id`. It also resolves `traditional/<type>/<key>` references through the existing Living Library reference lookup. No new identifiers are generated.

`Library.resolveCanonicalEntityId()` is the navigation boundary: it accepts only an existing canonical ID, a canonical Traditional reference, or an ID recorded as having been safely merged. Display names, slugs, filenames, asset IDs, and object-instance IDs are not treated as entity IDs. `Library.resolveObjectEntity()` may use an altar object's typed identity fields to find an existing Traditional reference, but returns the resulting canonical entity ID to every downstream caller.

During Traditional import, legacy automatically-created entities whose normalized name and compatible type unambiguously match a Traditional entry are merged into that canonical entity. My Practice and Community fields, aliases, relationships, timestamps, and legacy IDs are retained. Entities explicitly marked with `traditionalReference: null` remain intentionally custom and are never merged automatically.

## Event shape

`LivingConnections.createEvent()` returns an internal event with:

```js
{
  id,
  timestamp,            // ISO timestamp or null
  type,                 // stable internal event type
  source,               // owning subsystem
  entityId,             // canonical Living Library ID
  relatedEntityIds,     // canonical IDs, deduplicated
  relatedObjectIds,     // object-instance IDs, deduplicated
  label,                // source-provided, not UI-formatted HTML
  metadata
}
```

Events are computed at query time. The service does not store counters or timeline copies.

## Queries

* `getTimeline(entity, sources, { direction })` normalizes and deduplicates records, then returns stable chronological events.
* `getUsage(entity, sources)` returns `firstUse`, `lastUse`, `mostRecentUse`, `totalUses`, and chronological `uses`.
* `getPairings(entity, sources, { type })` counts co-occurrences from usage events and includes existing Living Library relationship types. Passing `type` narrows results to herbs, crystals, deities, recipes, or another existing entity type.
* `getPairingFrequency(entity, relatedEntity, sources)` returns the derived co-occurrence count for one canonical pair.
* `getObjectPairings(entity, sources)` and `getRitualTypeFrequency(entity, sources)` aggregate existing object-instance and ritual-source appearances without persisting counters.
* `getReferences(entity, sources)` groups rituals, journals, pages, templates, recipes, object activity, Library edges, and layer availability.
* `load(entity, options)` is the runtime adapter. It reuses the narrow object-event query and, when database/user access is available, fetches only ritual links and rituals relevant to the requested entity before computing the same pure results.

## Source object

Pure queries accept only the sources a caller already has:

```js
{
  library: Library,
  objectEvents: [],
  livingStates: [],       // { entityId, objectId, state } records
  rituals: [],
  ritualLinks: [],
  templates: [],
  apothecaryItems: [],
  grimoirePages: [],
  pageLinks: [],
  events: []             // already-standardized or custom internal events
}
```

This makes the service usable by future Living Entity pages, Companion intelligence, and Sanctuary search without requiring those features to traverse each subsystem differently.

## Duplicate prevention

Persistence continues using existing protection:

* `Library.connect()` / `connectUnique()` prevent duplicate local edges.
* Supabase `library_relations` upserts use the existing `(user, from, relation, to)` conflict key.
* Ritual journal links retain their existing full-identity filter.
* Query results are defensively deduplicated by source, source record ID, event type, entity, and timestamp. This does not delete or mutate stored records.

## Limitations

The service can only report connections represented by existing IDs or structured records. It does not infer mentions from prose, parse arbitrary journal text, or fabricate timestamps for undated Library relationships. Community and knowledge-layer references report whether the canonical entity has content; semantic analysis belongs to a later search/indexing phase.
