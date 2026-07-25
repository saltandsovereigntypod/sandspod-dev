/* =========================================================
   SELECTION INTERACTION GUARD
   Keeps the Companion click-driven, preserves mobile selection,
   and repairs missing Living State links on older saved objects.
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

  const originalShowAltarCompanionPanel =
    typeof window.showAltarCompanionPanel === "function"
      ? window.showAltarCompanionPanel
      : null;

  const originalCaptureAltarSnapshot =
    typeof window.captureAltarSnapshot === "function"
      ? window.captureAltarSnapshot
      : null;

  async function resolveMissingInstanceId(object) {
    if (!object) return null;

    const storedInstanceId = object.dataset.instanceId || "";

    if (storedInstanceId && typeof window.getObjectInstance === "function") {
      const storedInstance = await window.getObjectInstance(storedInstanceId);

      if (storedInstance) {
        return storedInstance;
      }

      object.dataset.instanceId = "";
    }

    const entityId = object.dataset.entityId || "";

    if (!entityId || typeof window.getObjectInstancesByEntity !== "function") {
      return null;
    }

    const instances = await window.getObjectInstancesByEntity(entityId);

    if (!Array.isArray(instances) || instances.length === 0) {
      return null;
    }

    const apothecaryItemId = object.dataset.apothecaryItemId || "";
    const altarObjectKey = object.dataset.altarObjectId || "";

    const matchedInstance =
      (apothecaryItemId
        ? instances.find(
            (instance) => instance.apothecary_item_id === apothecaryItemId
          )
        : null) ||
      (altarObjectKey
        ? instances.find(
            (instance) => instance.altar_object_key === altarObjectKey
          )
        : null) ||
      instances.find((instance) => instance.status === "active") ||
      instances[0];

    if (!matchedInstance?.id) return null;

    object.dataset.instanceId = matchedInstance.id;

    if (typeof window.saveWorkingAltarDraft === "function") {
      window.saveWorkingAltarDraft();
    }

    return matchedInstance;
  }

  /* Repair older altar saves that retained the Library entity but lost the
     physical object instance link. Resolve the best matching active instance
     before the Companion renders so tending details appear immediately. */
  if (originalShowAltarCompanionPanel) {
    window.showAltarCompanionPanel = async function showCompanionWithLivingState(object) {
      if (!object) return;

      await resolveMissingInstanceId(object);
      return originalShowAltarCompanionPanel(object);
    };
  }

  /* Undo/redo snapshots previously omitted these identifiers. Add them back
     from the live altar objects so restored objects keep their Living State. */
  if (originalCaptureAltarSnapshot) {
    window.captureAltarSnapshot = function captureSnapshotWithLivingStateLinks() {
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

  /* Legacy pointerenter listeners still call this function.
     Only allow the currently clicked object to update the Companion. */
  if (originalShowAltarInfoCard) {
    window.showAltarInfoCard = function showSelectedAltarInfoCardOnly(object) {
      if (!object) return;
      if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

      return originalShowAltarInfoCard(object);
    };
  }

  /* Legacy pointerleave listeners must not clear an intentional selection. */
  if (originalHideAltarInfoCard) {
    window.hideAltarInfoCard = function preserveSelectedAltarInfoCard() {
      if (typeof selectedObject !== "undefined" && selectedObject) return;
      return originalHideAltarInfoCard();
    };
  }

  /* The older global pointerdown listener deselects before a touch gesture
     has a chance to become a scroll. Stop that listener only for harmless
     touch scrolling outside interactive altar controls. */
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
})();
