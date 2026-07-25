/* =========================================================
   SELECTION INTERACTION GUARD
   Keeps selection click-driven and preserves mobile scrolling.
   Living State UI now belongs to the Companion module.
   ========================================================= */

(function initializeSelectionInteractionGuard() {
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

      const interactiveTarget = event.target.closest(
        "button, a, input, textarea, select, label, .altar-object, .altar-toolbar, " +
        ".altar-action-bar, .altar-companion-panel, .altar-cabinet-overlay, " +
        ".saved-altars-modal, .altar-save-modal, .living-state-tend-modal"
      );

      if (interactiveTarget) return;
      event.stopPropagation();
    },
    true
  );

  if (!document.querySelector('script[data-companion-living-state-module]')) {
    const script = document.createElement("script");
    script.src = "js/ui/companion-living-state.js";
    script.defer = true;
    script.setAttribute("data-companion-living-state-module", "");
    document.body.appendChild(script);
  }
})();
