/* =========================================================
   COMPANION ACTION REFRESH BRIDGE
   Keeps lifecycle actions focused on the unified Companion page.
   ========================================================= */

(function initializeCompanionActionRefreshBridge() {
  let queuedRefresh = null;

  function getCompanionPanel() {
    return (
      (typeof altarCompanionPanel !== "undefined" ? altarCompanionPanel : null) ||
      document.querySelector(".altar-companion-panel")
    );
  }

  function polishCompanionMarkup() {
    const panel = getCompanionPanel();
    if (!panel) return;

    // These labels described information that is already shown directly in
    // the Companion, so keeping them created a second, non-interactive copy.
    panel.querySelector("[data-companion-emphasis]")?.remove();

    // Apothecary and Living Library editing are separate destinations. Their
    // labels should make that distinction clear when both actions are present.
    const apothecaryEdit = panel.querySelector("[data-apothecary-edit]");
    if (apothecaryEdit && apothecaryEdit.textContent !== "Edit Apothecary Item") {
      apothecaryEdit.textContent = "Edit Apothecary Item";
    }

    const libraryEdit = panel.querySelector(
      '[data-library-edit-section="myPractice"]'
    );
    if (libraryEdit && libraryEdit.textContent !== "Edit Library Entry") {
      libraryEdit.textContent = "Edit Library Entry";
    }
  }

  function wrapCompanionRenderer(functionName) {
    const originalRenderer = window[functionName];

    if (typeof originalRenderer !== "function" || originalRenderer.__companionPolishWrapped) {
      return;
    }

    function companionAwareRenderer(...args) {
      const result = originalRenderer.apply(this, args);
      queueMicrotask(polishCompanionMarkup);
      return result;
    }

    companionAwareRenderer.__companionPolishWrapped = true;
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

    return Promise.resolve(window.showAltarCompanionPanel(target))
      .then(() => {
        polishCompanionMarkup();
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

  wrapCompanionRenderer("showAltarCompanionPanel");
  wrapCompanionRenderer("showLibraryEntityInCompanion");
  wrapLifecycleSubmitHandler("submitLivingStateTendForm");
  wrapLifecycleSubmitHandler("submitLivingStateActivityForm");
  polishCompanionMarkup();

  document.addEventListener("companion:refresh", (event) => {
    refreshSelectedCompanion(event.detail?.object || null);
  });
})();
