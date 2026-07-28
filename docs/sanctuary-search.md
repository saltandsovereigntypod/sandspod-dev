# Sanctuary Search

`js/sanctuary-search.js` is a read-only, in-memory discovery index. It does not replace the Grimoire page search, Living Library shelf filters, cabinet search, Community search, or Apothecary ingredient search.

## Sources

The shared UI adapter derives records from the already-loaded canonical Living Library, Book of Shadows pages and sections, My Rituals, Ritual Templates, Apothecary items, objects currently on the Altar, and the existing Altar Cabinet catalogue. Current Altar and Altar Cabinet are deliberately separate result groups. Cabinet results open the Altar with its existing cabinet focused on the matching category. Local sources are indexed when the modal opens; cloud-backed ritual and template collections update the same index progressively when their existing loaders resolve.

Knowledge-layer visibility follows the existing local Sanctuary settings. Traditional, My Practice, or Community fields hidden by those settings are not placed in searchable text. No index is persisted.

## Result identity and navigation

Every result uses the shared shape returned by `SanctuarySearch.createResult()`. Living Library and Altar-object destinations pass through `Library.resolveCanonicalEntityId()` before a URL is returned. Book pages use the existing `?page=` route, templates use the existing `?editRitualTemplate=` route, and records without a supported detail destination remain non-clickable context.

Display names, slugs, filenames, asset paths, UUID fields, and object-instance IDs are not navigation identities and are excluded from structured searchable text.

## Ranking

Ranking is deterministic: exact title, exact alias, title prefix, title word boundary, structured field, relationship context, then broader text. Results are deduplicated by source group and stable source ID, grouped for presentation, and may be filtered by group.

Relationship labels on Living Library results are derived through `LivingConnections.getReferences()` rather than a separate graph traversal or stored recommendation score.

## Progressive and stale-safe behavior

Opening search builds the local index synchronously. Existing cloud loaders may add sources afterward through `updateSource()`. A request token prevents late enrichment from rendering after the search closes or a newer search session opens. Searches themselves only scan the current in-memory index and never issue per-keystroke database requests.
