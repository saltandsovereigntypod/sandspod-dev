# Living Object State

Living Object State is the canonical mutable history attached to an Altar object instance; it is separate from Living Library entity identity and visual placement. Version 2 extends the existing candle section without creating a parallel candle store.

Candle intervals are append-only and deduplicated by event identity. Expected life locks on first light, spent state is irreversible, and archive state remains distinct from spent state. Replacement preserves the retired instance history while a new instance starts fresh. Saved Altars, guest persistence, cloud object state, backups, restores, and guest migration must preserve the opaque `livingState` value and `altarObjectId` together.

See [Candle lifecycle](candle-lifecycle.md) for the full shape, reconciliation rules, accessibility behavior, conflict policy, and test checklist.
