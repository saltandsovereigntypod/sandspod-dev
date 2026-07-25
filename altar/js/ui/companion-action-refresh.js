/* =========================================================
   COMPANION ACTION REFRESH BRIDGE
   Keeps lifecycle actions focused on the unified Companion page
   while older action handlers are gradually renamed and cleaned up.
   ========================================================= */

(function initializeCompanionActionRefreshBridge() {
  let queuedRefresh = null;

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

  window.refreshAltarCompanion = refreshSelectedCompanion;

  // Temporary compatibility alias for lifecycle action handlers that still
  // call the former Living State refresh function. Remove after those callers
  // have been migrated to refreshAltarCompanion or the companion:refresh event.
  window.showLivingStatePanel = refreshSelectedCompanion;

  document.addEventListener("companion:refresh", (event) => {
    refreshSelectedCompanion(event.detail?.object || null);
  });
})();
