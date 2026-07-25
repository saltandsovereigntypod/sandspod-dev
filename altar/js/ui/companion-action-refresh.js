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

  function loadCompanionV4() {
    if (window.scheduleCompanionV4 || document.querySelector('script[data-companion-v4-loader]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = "js/ui/companion-v4.js";
    script.defer = true;
    script.setAttribute("data-companion-v4-loader", "");
    document.head.appendChild(script);
  }

  function polishCompanionMarkup() {
    const panel = getCompanionPanel();
    if (!panel) return;

    panel.querySelector("[data-companion-emphasis]")?.remove();

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

  function applyActiveCompanionLayer(object = null) {
    polishCompanionMarkup();

    if (typeof window.scheduleCompanionV4 === "function") {
      window.scheduleCompanionV4(object);
    }
  }

  function wrapCompanionRenderer(functionName) {
    const originalRenderer = window[functionName];

    if (typeof originalRenderer !== "function" || originalRenderer.__companionPolishWrapped) {
      return;
    }

    function companionAwareRenderer(...args) {
      const result = originalRenderer.apply(this, args);
      queueMicrotask(() => applyActiveCompanionLayer(args[0] || null));
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
        applyActiveCompanionLayer(target);
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

  loadCompanionV4();
  wrapCompanionRenderer("showAltarCompanionPanel");
  wrapCompanionRenderer("showLibraryEntityInCompanion");
  wrapLifecycleSubmitHandler("submitLivingStateTendForm");
  wrapLifecycleSubmitHandler("submitLivingStateActivityForm");
  applyActiveCompanionLayer();

  document.addEventListener("companion:refresh", (event) => {
    refreshSelectedCompanion(event.detail?.object || null);
  });
})();
