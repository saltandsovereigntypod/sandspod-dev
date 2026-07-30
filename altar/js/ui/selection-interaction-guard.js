/* =========================================================
   SELECTION INTERACTION GUARD
   Keeps selection click-driven and preserves mobile scrolling.
   Companion content and lifecycle rendering live in companion-v2.js.
   ========================================================= */

(function initializeSelectionInteractionGuard() {
  // Selected-object action controls are intentionally outside this module.
  // This guard owns only selection, snapshot-link, and touch-boundary behavior.
  const INTERACTIVE_SELECTION_TARGETS = [
    "button", "a", "input", "textarea", "select", "label",
    ".altar-object", ".altar-toolbar", ".altar-action-bar",
    ".altar-companion-panel", ".altar-cabinet-overlay",
    ".saved-altars-modal", ".altar-save-modal",
    ".living-state-practice-modal", ".living-state-tend-modal",
    ".living-state-activity-modal"
  ].join(", ");

  const originalShowAltarInfoCard =
    typeof window.showAltarInfoCard === "function"
      ? window.showAltarInfoCard
      : null;

  const originalHideAltarInfoCard =
    typeof window.hideAltarInfoCard === "function"
      ? window.hideAltarInfoCard
      : null;

  const originalCaptureAltarSnapshot =
    typeof window.captureAltarSnapshot === "function"
      ? window.captureAltarSnapshot
      : null;

  if (originalCaptureAltarSnapshot) {
    window.captureAltarSnapshot = function captureSnapshotWithObjectLinks() {
      const snapshot = originalCaptureAltarSnapshot();

      if (!snapshot || !Array.isArray(snapshot.objects)) return snapshot;

      const liveObjects = Array.from(
        document.querySelectorAll(".altar-stage .altar-object")
      );

      snapshot.objects = snapshot.objects.map((savedObject, index) => {
        const liveObject = liveObjects[index];
        if (!liveObject) return savedObject;

        return {
          ...savedObject,
          entityId: liveObject.dataset.entityId || savedObject.entityId || "",
          instanceId: liveObject.dataset.instanceId || savedObject.instanceId || ""
        };
      });

      return snapshot;
    };
  }

  if (originalShowAltarInfoCard) {
    window.showAltarInfoCard = function showSelectedAltarInfoCardOnly(object) {
      if (!object) return;
      if (typeof selectedObject !== "undefined" && selectedObject !== object) return;
      return originalShowAltarInfoCard(object);
    };
  }

  if (originalHideAltarInfoCard) {
    window.hideAltarInfoCard = function preserveSelectedAltarInfoCard() {
      if (typeof selectedObject !== "undefined" && selectedObject) return;
      return originalHideAltarInfoCard();
    };
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") return;
      if (typeof selectedObject === "undefined" || !selectedObject) return;

      const interactiveTarget = event.target.closest(INTERACTIVE_SELECTION_TARGETS);

      if (interactiveTarget) return;
      event.stopPropagation();
    },
    true
  );

  /* =========================================================
     MOBILE CABINET TAP GUARD
     Prevent a scroll gesture from becoming a placement click, and
     suppress duplicate synthetic activations from the same tap.
     ========================================================= */

  const cabinetGesture = {
    pointerId: null,
    target: null,
    startX: 0,
    startY: 0,
    moved: false,
    endedAt: 0
  };
  let lastCabinetActivationKey = "";
  let lastCabinetActivationAt = 0;

  function getCabinetActionTarget(target) {
    return target?.closest?.(
      "[data-altar-cabinet-overlay] [data-image], " +
      "[data-altar-cabinet-overlay] [data-background], " +
      "[data-altar-cabinet-overlay] [data-cabinet-category]"
    ) || null;
  }

  function getCabinetActionKey(target) {
    if (!target) return "";

    return [
      target.dataset.image || "",
      target.dataset.label || "",
      target.dataset.background || "",
      target.dataset.backgroundName || "",
      target.dataset.cabinetCategory || ""
    ].join("|");
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") return;

      const target = getCabinetActionTarget(event.target);
      if (!target) return;

      cabinetGesture.pointerId = event.pointerId;
      cabinetGesture.target = target;
      cabinetGesture.startX = event.clientX;
      cabinetGesture.startY = event.clientY;
      cabinetGesture.moved = false;
      cabinetGesture.endedAt = 0;
    },
    true
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerId !== cabinetGesture.pointerId || !cabinetGesture.target) return;

      const distanceX = event.clientX - cabinetGesture.startX;
      const distanceY = event.clientY - cabinetGesture.startY;

      if (Math.hypot(distanceX, distanceY) > 10) {
        cabinetGesture.moved = true;
      }
    },
    true
  );

  function finishCabinetGesture(event) {
    if (event.pointerId !== cabinetGesture.pointerId) return;
    cabinetGesture.endedAt = Date.now();
    cabinetGesture.pointerId = null;
  }

  document.addEventListener("pointerup", finishCabinetGesture, true);
  document.addEventListener("pointercancel", finishCabinetGesture, true);

  document.addEventListener(
    "click",
    (event) => {
      const target = getCabinetActionTarget(event.target);
      if (!target) return;

      const now = Date.now();
      const sameGestureTarget =
        cabinetGesture.target === target ||
        cabinetGesture.target?.contains?.(target) ||
        target.contains?.(cabinetGesture.target);

      if (
        cabinetGesture.moved &&
        sameGestureTarget &&
        cabinetGesture.endedAt &&
        now - cabinetGesture.endedAt < 900
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cabinetGesture.target = null;
        return;
      }

      const activationKey = getCabinetActionKey(target);

      if (
        activationKey &&
        activationKey === lastCabinetActivationKey &&
        now - lastCabinetActivationAt < 650
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      lastCabinetActivationKey = activationKey;
      lastCabinetActivationAt = now;
      cabinetGesture.target = null;
    },
    true
  );

  /* =========================================================
     MOBILE ALTAR DRAG SELECTION GUARD
     Keep touch dragging from selecting text elsewhere on the page.
     ========================================================= */

  let activeTouchDragPointerId = null;
  let previousBodyUserSelect = "";
  let previousBodyWebkitUserSelect = "";
  let previousRootUserSelect = "";
  let previousRootWebkitUserSelect = "";

  function clearPageSelection() {
    const selection = window.getSelection?.();
    if (selection && selection.rangeCount) selection.removeAllRanges();
  }

  function beginTouchDrag(event) {
    if (event.pointerType === "mouse") return;

    const object = event.target.closest?.(".altar-object");
    if (!object || object.dataset.locked === "true") return;

    activeTouchDragPointerId = event.pointerId;
    previousBodyUserSelect = document.body.style.userSelect;
    previousBodyWebkitUserSelect = document.body.style.webkitUserSelect;
    previousRootUserSelect = document.documentElement.style.userSelect;
    previousRootWebkitUserSelect = document.documentElement.style.webkitUserSelect;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitUserSelect = "none";

    clearPageSelection();
    event.preventDefault();
  }

  function maintainTouchDrag(event) {
    if (event.pointerId !== activeTouchDragPointerId) return;
    clearPageSelection();
    event.preventDefault();
  }

  function finishTouchDrag(event) {
    if (event.pointerId !== activeTouchDragPointerId) return;

    activeTouchDragPointerId = null;
    document.body.style.userSelect = previousBodyUserSelect;
    document.body.style.webkitUserSelect = previousBodyWebkitUserSelect;
    document.documentElement.style.userSelect = previousRootUserSelect;
    document.documentElement.style.webkitUserSelect = previousRootWebkitUserSelect;
    clearPageSelection();
  }

  document.addEventListener("pointerdown", beginTouchDrag, true);
  document.addEventListener("pointermove", maintainTouchDrag, { capture: true, passive: false });
  document.addEventListener("pointerup", finishTouchDrag, true);
  document.addEventListener("pointercancel", finishTouchDrag, true);

  document.addEventListener(
    "selectstart",
    (event) => {
      if (activeTouchDragPointerId === null) return;
      event.preventDefault();
    },
    true
  );

  document.addEventListener(
    "dragstart",
    (event) => {
      if (!event.target.closest?.(".altar-object")) return;
      event.preventDefault();
    },
    true
  );

  document.addEventListener(
    "contextmenu",
    (event) => {
      if (activeTouchDragPointerId === null) return;
      if (!event.target.closest?.(".altar-object")) return;
      event.preventDefault();
    },
    true
  );

  /* =========================================================
     PERSISTENT MOBILE ACTION DRAWER
     Keep See More open across repeated actions for the same object,
     while preserving explicit and accessible ways to close it.
     ========================================================= */

  const mobileActionQuery = window.matchMedia("(max-width: 900px)");
  let keepActionDrawerOpen = false;
  let actionDrawerObject = null;
  let actionDrawerRestoreQueued = false;

  function selectedAltarObject() {
    return typeof selectedObject !== "undefined" && selectedObject
      ? selectedObject
      : document.querySelector(".altar-object.is-selected");
  }

  function closePersistentActionDrawer() {
    keepActionDrawerOpen = false;
    actionDrawerObject = null;

    if (typeof window.closeObjectActionOverflow === "function") {
      window.closeObjectActionOverflow();
    }
  }

  function addActionDrawerCloseButton(popup) {
    if (!popup || popup.querySelector("[data-close-persistent-actions]")) return;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "button button--small button--ghost altar-action-drawer-close";
    closeButton.dataset.closePersistentActions = "";
    closeButton.setAttribute("role", "menuitem");
    closeButton.innerHTML = '<span aria-hidden="true">×</span><span>Close Actions</span>';
    popup.prepend(closeButton);
  }

  function restorePersistentActionDrawer() {
    actionDrawerRestoreQueued = false;

    if (!mobileActionQuery.matches || !keepActionDrawerOpen) return;

    const current = selectedAltarObject();
    if (!current || current !== actionDrawerObject || !current.isConnected) {
      closePersistentActionDrawer();
      return;
    }

    const toolbarElement = document.querySelector(".altar-toolbar");
    const more = toolbarElement?.querySelector("[data-object-action-more]");
    const popup = toolbarElement?.querySelector("[data-object-action-overflow]");
    const backdrop = toolbarElement?.querySelector("[data-object-action-backdrop]");

    if (!more || !popup) return;

    addActionDrawerCloseButton(popup);
    popup.hidden = false;
    if (backdrop) backdrop.hidden = false;
    more.setAttribute("aria-expanded", "true");
    document.body.classList.add("altar-action-sheet-open");
  }

  function queueActionDrawerRestore() {
    if (actionDrawerRestoreQueued) return;
    actionDrawerRestoreQueued = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(restorePersistentActionDrawer);
    });
  }

  const actionToolbar = document.querySelector(".altar-toolbar");
  if (actionToolbar) {
    const actionToolbarObserver = new MutationObserver(() => {
      if (keepActionDrawerOpen) queueActionDrawerRestore();
    });

    actionToolbarObserver.observe(actionToolbar, {
      childList: true,
      subtree: true
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      const more = event.target.closest?.("[data-object-action-more]");
      if (more && mobileActionQuery.matches) {
        const wasOpen = more.getAttribute("aria-expanded") === "true";

        if (wasOpen) {
          keepActionDrawerOpen = false;
          actionDrawerObject = null;
        } else {
          keepActionDrawerOpen = true;
          actionDrawerObject = selectedAltarObject();
          queueActionDrawerRestore();
        }

        return;
      }

      const closeButton = event.target.closest?.("[data-close-persistent-actions]");
      if (closeButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePersistentActionDrawer();
        document.querySelector("[data-object-action-more]")?.focus();
        return;
      }

      const overflowAction = event.target.closest?.(
        "[data-object-action-overflow] [data-action], " +
        "[data-object-action-overflow] [data-global-action]"
      );

      if (overflowAction && mobileActionQuery.matches) {
        const actionId = overflowAction.dataset.action || "";

        if (["back-to-altar", "delete"].includes(actionId)) {
          keepActionDrawerOpen = false;
          actionDrawerObject = null;
          return;
        }

        keepActionDrawerOpen = true;
        actionDrawerObject = selectedAltarObject();
        queueActionDrawerRestore();
        return;
      }

      if (
        keepActionDrawerOpen &&
        event.target.closest?.("[data-object-action-backdrop]")
      ) {
        closePersistentActionDrawer();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || !keepActionDrawerOpen) return;
      closePersistentActionDrawer();
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!keepActionDrawerOpen || !mobileActionQuery.matches) return;
      if (event.target.closest?.(".altar-object-actions-more-wrap, [data-object-action-modal], [role='dialog']")) return;
      closePersistentActionDrawer();
    },
    true
  );

  mobileActionQuery.addEventListener?.("change", (event) => {
    if (!event.matches) closePersistentActionDrawer();
  });
})();
