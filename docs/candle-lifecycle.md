# Candle lifecycle

Digital Altar candle time is an **approximation**, not a scientific or manufacturer-specific prediction. Form is the only input to the default; color, dressing, intention, ritual, environment, and device never alter it.

## Form inventory and defaults

The authoritative map is `altar/js/features/candle-lifecycle.js` and covers every form exposed by `js/sanctuary-asset-catalog.js`.

| Form | Approximate default |
| --- | ---: |
| Chime / spell candle | 2 hours |
| Taper candle | 8 hours |
| Tea light | 4 hours |
| Pillar candle | 60 hours |
| Vigil candle | 7 days |

Physical size, wick, wax, holder, drafts, and manufacturer can produce materially different results. A user may set a positive custom value up to 365 days before first lighting. An unrecognized custom form has no guessed default and cannot be lit until a duration is supplied.

## Canonical state

Lifecycle version 2 lives inside Living Object State's `candle` section. It records form, expected and accumulated milliseconds, first/current/last timestamps, estimated burnout, locked/spent/archive state, replacement links, duration changes, dressings, append-only burn intervals, and the acknowledged burnout-notification event. ISO-8601 UTC timestamps and the candle object-instance identity are the source of truth.

First successful lighting permanently locks expected life. A failed light does not. A spent or archived candle cannot be relit, shortened, lengthened, or reset. Burn time is clamped to expected life and remaining life cannot be negative.

Each completed interval has a stable identity derived from the candle instance and its lit timestamp, a lit and extinguished time, duration, end reason, and optional ritual/Altar identity. Known reasons are `manual_extinguish`, `ritual_ended`, `candle_life_reached`, `removed_from_altar`, `replaced`, `recovered_after_reopening`, and `other`. Duplicate event identities are ignored.

## Reconciliation and scheduling

`reconcile()` compares the stored start timestamp with the current timestamp. Closing or backgrounding the browser therefore does not pause a burning candle. One shared page scheduler wakes for the nearest burnout (or at most once per minute), while visibility and focus reconciliation handle throttled background tabs. No per-candle database interval and no every-second persistence is used.

Clock movement backward is treated as ambiguous and does not add time. Cross-device copies of the same active interval share an event identity, histories are deduplicated, and the same wall-clock start is counted once. This conservative rule treats one canonical instance as one physical candle. The current client still relies on the existing last-write object-state sync; a future database event constraint would provide stronger simultaneous-device transaction guarantees.

## User behavior

- **Companion:** shows form, expected/burned/remaining time, status, last light, estimated burnout, replacement need, and expandable history. Its shared formatter uses floor-based day/hour/minute/second decomposition, and a single display-only timer previews the active interval once per second without saving or syncing each tick. Duration editing is shown only before first light.
- **Spent state:** desaturates only the candle art and adds visible `Spent` text. It remains selectable, movable, inspectable, removable, and replaceable.
- **Replacement:** archives the old history in a device archive record, creates a new object identity at the same placement, and clears burning state, history, dressings, and ritual inclusion. Replacement is not a reset.
- **Duplication:** creates a fresh unlocked candle identity with default full life and no burn history. Existing dressing-copy behavior is preserved for duplicate, but burn state is never copied.
- **Removal:** a lit candle is first reconciled and extinguished with `removed_from_altar`.
- **Summary:** intentional extinguishing opens a calm, keyboard-closeable `Remaining candle life on this Altar` dialog with every active candle. Rows stack on small screens.
- **Burnout:** the candle is marked spent and extinguished exactly once. A calm toast is shown when reconciliation discovers the burnout, then its event marker prevents refresh repetition.

## Ritual behavior

Templates store `settings.candle_end_behavior` as `keep_burning`, `extinguish_at_end`, or `ask_at_end`; old templates safely default to ask. A session snapshot preserves the default without mutating the template. Candles participate only when explicitly marked **Include in Ritual** by object-instance identity. Decorative candles are excluded.

Before a template ritual begins, linked candles are reconciled and compared with the estimated step duration. An insufficient candle produces a non-blocking Continue confirmation and tells the user it may be replaced or removed first. At completion, only linked candles follow the session behavior; ritual extinguishing records `ritual_ended` and shows one summary.

## Persistence and recovery

Saved-Altar snapshots include `altarObjectId`, Living Object State, and `ritualIncluded`. Guest drafts remain in browser persistence. Signed-in snapshots use the existing Supabase persistence. Backup, restore, and guest migration already carry arbitrary sanitized object records and Living state; the version-2 fields therefore travel with the instance and old version-1 states normalize in memory.

## Accessibility and limitations

Spent status includes text, summary and warnings use real buttons/native dialogs, history is expandable, rows reflow at 320px, and reduced motion stops decorative flame animation without changing timestamp correctness. Browser zoom remains unrestricted.

Physical-device, multi-profile cloud, and long-running offline reconciliation tests remain required before treating simultaneous-device conflict behavior as fully proven. Replacement archives are currently device-local in addition to the preserved Living state event history; an authenticated archived-object database view is a future enhancement. No claim of exact physical burn time or full accessibility conformance is made.

### Display precision correction

The original lifecycle display converted milliseconds to minutes with `Math.ceil`, causing any positive sub-minute burn to display as one minute and concealing seconds from long remaining durations. Display formatting now floors only at the second boundary. Effective burned time is the immutable persisted total plus at most one valid active interval; remaining time subtracts that preview from expected life and clamps at zero. These calculations clone/normalize input and never mutate or persist during a visual tick. The generic Current State card suppresses candle burn time and last-burned rows so Candle Life is the sole lifecycle presentation. Companion candle titles are display-only: catalog/persistence labels and the form badge remain unchanged.

## Manual development checklist

Use disposable data and a two-minute custom duration: light for 30 seconds, extinguish, relight, close, return after burnout, verify one notification/history interval and no relight. Then verify lock persistence, replacement, saved-Altar identity, another browser profile, the three ritual-end settings, linked-versus-decorative warnings, summary contents, and widths 320/375/390/430/768 px.
