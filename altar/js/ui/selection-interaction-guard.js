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
})();
