/* =========================================================
   COMPANION ACTION REFRESH BRIDGE
   Keeps lifecycle actions focused on the unified Companion page and
   hands each completed render to the single V4 presentation layer.
   ========================================================= */

(function initializeCompanionActionRefreshBridge() {
  let queuedRefresh = null;
  let refreshInProgress = false;

  function applyCompanionPresentation(target = null) {
    if (typeof window.scheduleCompanionV4 === "function") {
      window.scheduleCompanionV4(target);
    }
  }

  function wrapCompanionRenderer(functionName) {
    const originalRenderer = window[functionName];

    if (
      typeof originalRenderer !== "function" ||
      originalRenderer.__companionPresentationWrapped
    ) {
      return;
    }

    function companionAwareRenderer(...args) {
      const result = originalRenderer.apply(this, args);

      if (!refreshInProgress) {
        queueMicrotask(() => applyCompanionPresentation(args[0] || null));
      }

      return result;
    }

    companionAwareRenderer.__companionPresentationWrapped = true;
    window[functionName] = companionAwareRenderer;
  }

  function getSelectedCompanionTarget(object = null) {
    return (
      object ||
      (typeof selectedObject !== "undefined" ? selectedObject : null)
    );
  }

  function runCompanionRefresh(object = null) {
    const target = getSelectedCompanionTarget(object);

    if (!target || typeof window.showAltarCompanionPanel !== "function") {
      return Promise.resolve(false);
    }

    refreshInProgress = true;

    return Promise.resolve(window.showAltarCompanionPanel(target))
      .then(() => {
        document.dispatchEvent(
          new CustomEvent("companion:refreshed", {
            detail: { object: target }
          })
        );
        return true;
      })
      .catch((error) => {
        console.error("Unable to refresh the Altar Companion.", error);
        return false;
      })
      .finally(() => {
        refreshInProgress = false;
      });
  }

  function refreshSelectedCompanion(object = null) {
    const target = getSelectedCompanionTarget(object);

    if (queuedRefresh) {
      cancelAnimationFrame(queuedRefresh.frameId);
      queuedRefresh.resolve(false);
    }

    return new Promise((resolve) => {
      const frameId = requestAnimationFrame(() => {
        queuedRefresh = null;
        runCompanionRefresh(target).then(resolve);
      });

      queuedRefresh = { frameId, resolve };
    });
  }

  function wrapLifecycleSubmitHandler(functionName) {
    const originalHandler = window[functionName];

    if (
      typeof originalHandler !== "function" ||
      originalHandler.__companionRefreshWrapped
    ) {
      return;
    }

    async function companionAwareSubmitHandler(...args) {
      const result = await originalHandler.apply(this, args);
      await refreshSelectedCompanion();
      return result;
    }

    companionAwareSubmitHandler.__companionRefreshWrapped = true;
    window[functionName] = companionAwareSubmitHandler;
  }

  window.refreshAltarCompanion = refreshSelectedCompanion;

  wrapCompanionRenderer("showAltarCompanionPanel");
  wrapCompanionRenderer("showLibraryEntityInCompanion");
  wrapLifecycleSubmitHandler("submitLivingStateTendForm");
  wrapLifecycleSubmitHandler("submitLivingStateActivityForm");
  applyCompanionPresentation();

  document.addEventListener("companion:refresh", (event) => {
    refreshSelectedCompanion(event.detail?.object || null);
  });
})();
