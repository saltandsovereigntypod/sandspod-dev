/* =========================================================
   MOBILE OBJECT TOOLBAR
   Keeps responsive object action overflow synchronized with the viewport.
   ========================================================= */

(function initializeMobileObjectToolbar() {
  const mobileQuery = window.matchMedia("(max-width: 900px)");
  let pendingActionPosition = null;
  let restoreQueued = false;

  function refreshToolbarForViewport() {
    if (typeof renderSelectedObjectActions === "function") {
      renderSelectedObjectActions();
    }
  }

  function captureActionPosition(event) {
    if (!mobileQuery.matches) return;

    const action = event.target.closest?.(
      "[data-object-action-overflow] [data-action], " +
      "[data-object-action-overflow] [data-global-action]"
    );

    if (!action) return;

    const popup = action.closest("[data-object-action-overflow]");
    const actionId = action.dataset.action || "";
    const globalActionId = action.dataset.globalAction || "";

    if (["back-to-altar", "delete"].includes(actionId)) {
      pendingActionPosition = null;
      return;
    }

    pendingActionPosition = {
      actionId,
      globalActionId,
      viewportTop: action.getBoundingClientRect().top,
      pageScrollY: window.scrollY,
      popupScrollTop: popup?.scrollTop || 0,
      selectedObject: typeof selectedObject !== "undefined" ? selectedObject : null
    };
  }

  function restoreActionPosition() {
    restoreQueued = false;

    if (!pendingActionPosition || !mobileQuery.matches) return;

    const currentObject = typeof selectedObject !== "undefined" ? selectedObject : null;
    if (
      pendingActionPosition.selectedObject &&
      currentObject !== pendingActionPosition.selectedObject
    ) {
      pendingActionPosition = null;
      return;
    }

    const popup = document.querySelector(
      ".altar-toolbar [data-object-action-overflow]:not([hidden])"
    );

    if (!popup) return;

    let action = null;

    if (pendingActionPosition.actionId) {
      action = Array.from(popup.querySelectorAll("[data-action]")).find(
        (button) => button.dataset.action === pendingActionPosition.actionId
      );
    } else if (pendingActionPosition.globalActionId) {
      action = Array.from(popup.querySelectorAll("[data-global-action]")).find(
        (button) => button.dataset.globalAction === pendingActionPosition.globalActionId
      );
    }

    if (popup.scrollHeight > popup.clientHeight) {
      popup.scrollTop = pendingActionPosition.popupScrollTop;
    }

    if (action) {
      const newTop = action.getBoundingClientRect().top;
      const delta = newTop - pendingActionPosition.viewportTop;

      if (Math.abs(delta) > 1) {
        window.scrollBy(0, delta);
      }
    } else {
      window.scrollTo(0, pendingActionPosition.pageScrollY);
    }

    pendingActionPosition = null;
  }

  function queueRestoreActionPosition() {
    if (!pendingActionPosition || restoreQueued) return;

    restoreQueued = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(restoreActionPosition);
    });
  }

  refreshToolbarForViewport();

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", refreshToolbarForViewport);
  } else {
    mobileQuery.addListener(refreshToolbarForViewport);
  }

  window.addEventListener("orientationchange", () => {
    pendingActionPosition = null;
    window.requestAnimationFrame(refreshToolbarForViewport);
  });

  document.addEventListener("click", captureActionPosition, true);

  const toolbar = document.querySelector(".altar-toolbar");
  if (toolbar) {
    const observer = new MutationObserver(queueRestoreActionPosition);
    observer.observe(toolbar, {
      childList: true,
      subtree: true
    });
  }
})();
