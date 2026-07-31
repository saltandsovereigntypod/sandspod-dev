# Mobile Altar interactions

## Action drawer authority

`altar/js/features/object-actions.js` is the single owner of the selected-object action drawer. It tracks whether the overflow is open, the selected object that owns it, and the most recently activated action anchor. The selection interaction guard remains responsible only for touch/selection protections; it does not observe or reconstruct the drawer.

At widths up to 900px, `mobile-toolbar.css` places the overflow list in normal document flow with `position: static`, `max-height: none`, and `overflow: visible`. Consequently, the page is normally the scroll owner—not `.altar-object-actions-overflow`. The action module walks ancestors for a genuinely scrollable element and otherwise uses `document.scrollingElement`.

## Repeated-action anchoring

Before a mobile overflow action runs, the renderer records:

- the stable Altar object identity (Altar object ID, object-instance ID, or canonical entity ID);
- the action ID;
- the button's viewport position; and
- the actual scroll owner's position.

Ordinary transforms and state actions leave the drawer logically open. When an action requires a rerender, the module rebuilds the current action set, finds the same action, scrolls the real owner by the button's viewport-position delta, and restores focus with `preventScroll`. This supports repeated resize, rotation, layer, flip, glow, lock, and light actions without intentionally returning to the first action.

Modal actions leave the drawer open behind the dialog and do not move focus back into it while the dialog is active. A changed or disconnected selection invalidates the saved anchor.

## Leaving the drawer

The drawer closes through **Close Actions**, the **See More** toggle, Escape, outside/backdrop activation where applicable, deselection, deletion, selecting another object, or leaving the mobile breakpoint. Escape closes the drawer first; a later Escape may perform the normal deselection behavior.

The mobile close control is sticky so it remains reachable without obscuring the action list. All actions retain the existing labels, styling, and touch-target sizing.

## Preserved touch protections

The selection interaction guard continues to prevent non-mouse background gestures from becoming selection actions while allowing buttons, form controls, Altar objects, the toolbar, Cabinet overlays, and dialogs to receive their intended interactions. Existing Cabinet scroll/tap suppression, native image-drag prevention, and long-press protections remain in their owning modules.

## Manual verification

Browser verification should use touch emulation or a physical mobile browser at 320, 375, 390, 430, and 768 pixels. For each size, open **See More**, scroll to each transform/layer action, and activate it at least five times. Confirm the button stays in approximately the same viewport area and then test every exit listed above. Also open and cancel a modal action to confirm that dialog focus is not stolen.

This repository's unit tests verify state ownership, scroll-owner selection, anchor math, `preventScroll` focus, and exit rules. They do not substitute for real layout verification because viewport movement depends on the browser's rendering and mobile chrome.

## Cabinet placement lifecycle

The Cabinet previously placed items from a broad delegated `click` handler. Mobile browsers can emit that click after a pointer sequence used to scroll, and there was no gesture identity connecting the click to an intentional stationary tap. Because the Cabinet overlay remained active after placement, it could also continue intercepting Altar gestures and feel like a frozen stage.

`cabinet-activation.js` is now the sole Cabinet-object activation authority. One controller is registered per Cabinet root. It records primary `pointerdown`, permanently cancels activation after more than 10 CSS pixels of movement, records `pointerup` or `pointercancel`, and permits the subsequent click only for the same unmoved item. Nested targets resolve through `closest("[data-image]")`; keyboard-generated clicks remain supported.

Each accepted gesture receives a placement request ID. The controller rejects later synthetic clicks without a matching gesture, while `placeObject` independently refuses a completed request ID. Different later gestures remain immediately available; there is no multi-second global debounce.

Placement cleanup runs in `finally`: it releases source pointer capture and resets the Altar active object, pointer ID, offsets, drag snapshot, and dragging classes. Successful placement starts Cabinet overlay closing, and the closing overlay stops accepting pointer events before its transition completes. Failure releases the same state and shows a calm retry message.

Manual verification remains required on real touch browsers. Slowly scroll and flick without placing, tap at least ten distinct items, reopen repeatedly, and alternate moving old/new objects after at least ten placements at 320, 375, 390, 430, and 768 pixels.
# Candle-life mobile verification

The Candle Life Companion card and remaining-life summary use stacked label/value rows below 420px. Verify duration editing, spent labels, replacement confirmation, linked-candle warnings, summary closing, movement of spent candles, and the stable action drawer at 320, 375, 390, 430, and 768 px. Candle timing remains timestamp-based and does not depend on animation or continuous foreground timers. Physical mobile verification remains required when no device browser is available.

## Save dialogs

Save dialogs fit a 320px viewport, wrap actions, avoid horizontal overflow, support scaled text and high contrast, respect reduced motion, and restore keyboard focus. They do not alter the Cabinet or action drawer. See [Saved Altar modes](altar-save-modes.md).
