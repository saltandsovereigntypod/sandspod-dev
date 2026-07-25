/* =========================================================
   COMPANION ACTION REFRESH BRIDGE
   Keeps lifecycle actions focused on the unified Companion page.
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

  function wrapLifecycleSubmitHandler(functionName) {
    const originalHandler = window[functionName];

    if (typeof originalHandler !== "function" || originalHandler.__companionRefreshWrapped) {
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

  wrapLifecycleSubmitHandler("submitLivingStateTendForm");
  wrapLifecycleSubmitHandler("submitLivingStateActivityForm");

  document.addEventListener("companion:refresh", (event) => {
    refreshSelectedCompanion(event.detail?.object || null);
  });
})();
