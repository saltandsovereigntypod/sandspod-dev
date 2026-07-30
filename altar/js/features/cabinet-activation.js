(function initializeCabinetActivation(global) {
  "use strict";

  const MOVE_THRESHOLD = 10;
  const controllers = new WeakMap();
  let sequence = 0;

  function itemKey(item) {
    if (!item?.dataset) return "";
    return [item.dataset.entityId, item.dataset.type, item.dataset.form, item.dataset.label, item.dataset.image]
      .filter(Boolean).join(":");
  }

  function distance(gesture, event) {
    return Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
  }

  function createController({ root, activate, threshold = MOVE_THRESHOLD }) {
    if (!root || typeof activate !== "function") return null;
    if (controllers.has(root)) return controllers.get(root);
    let gesture = null;
    let activePlacement = null;

    function placementTarget(event) {
      if (event.target.closest("[data-upload-cabinet-image], [data-restore-cabinet-image], [data-delete-custom-background], [data-add-custom-background], [data-background]")) return null;
      return event.target.closest("[data-image]");
    }

    function begin(event) {
      if (!event.isPrimary || event.button > 0) return;
      const item = placementTarget(event);
      if (!item) return;
      gesture = {
        pointerId: event.pointerId,
        item,
        itemKey: itemKey(item),
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        cancelled: false,
        released: false
      };
    }

    function move(event) {
      if (!gesture || event.pointerId !== gesture.pointerId || gesture.moved) return;
      if (distance(gesture, event) > threshold) gesture.moved = true;
    }

    function finish(event, cancelled = false) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gesture.cancelled = gesture.cancelled || cancelled;
      gesture.released = true;
    }

    function end(event) { finish(event); }
    function cancel(event) { finish(event, true); }

    async function click(event) {
      const item = placementTarget(event);
      if (!item) return;

      const keyboard = event.detail === 0;
      const approvedGesture = !keyboard && gesture && gesture.item === item && gesture.released && !gesture.moved && !gesture.cancelled;
      if (!keyboard && !approvedGesture) {
        event.preventDefault();
        gesture = null;
        return;
      }

      const requestId = keyboard
        ? `keyboard-${Date.now()}-${++sequence}`
        : `pointer-${gesture.pointerId}-${++sequence}`;
      const key = itemKey(item);
      const pointerId = gesture?.pointerId ?? null;
      gesture = null;

      if (activePlacement?.requestId === requestId || activePlacement?.completed) return;
      activePlacement = { requestId, itemKey: key, pointerId, startedAt: Date.now(), completed: false };
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await activate({ item, requestId, pointerId });
        activePlacement.completed = true;
      } finally {
        activePlacement = null;
      }
    }

    root.addEventListener("pointerdown", begin);
    root.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", cancel);
    root.addEventListener("click", click);

    const controller = {
      destroy() {
        root.removeEventListener("pointerdown", begin);
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerup", end);
        root.removeEventListener("pointercancel", cancel);
        root.removeEventListener("click", click);
        gesture = null;
        activePlacement = null;
        controllers.delete(root);
      },
      state: () => ({ gesture: gesture ? { ...gesture, item: undefined } : null, activePlacement: activePlacement ? { ...activePlacement } : null })
    };
    controllers.set(root, controller);
    return controller;
  }

  const api = { MOVE_THRESHOLD, itemKey, createController };
  global.AltarCabinetActivation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
