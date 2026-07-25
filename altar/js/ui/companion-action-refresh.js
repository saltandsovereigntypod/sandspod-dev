/* =========================================================
   COMPANION ACTION REFRESH BRIDGE
   Keeps lifecycle actions focused on the unified Companion page
   while older action handlers are gradually renamed and cleaned up.
   ========================================================= */

(function initializeCompanionActionRefreshBridge() {
  async function refreshSelectedCompanion(object = null) {
    const target =
      object ||
      (typeof selectedObject !== "undefined" ? selectedObject : null);

    if (!target || typeof window.showAltarCompanionPanel !== "function") {
      return;
    }

    await window.showAltarCompanionPanel(target);
  }

  window.refreshAltarCompanion = refreshSelectedCompanion;

  // Temporary compatibility alias for lifecycle action handlers that still
  // call the former Living State refresh function.
  window.showLivingStatePanel = refreshSelectedCompanion;

  document.addEventListener("companion:refresh", (event) => {
    refreshSelectedCompanion(event.detail?.object || null);
  });
})();
