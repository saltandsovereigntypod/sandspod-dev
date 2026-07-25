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

  async function getValidInstance(instanceId) {
    if (!instanceId || typeof window.getObjectInstance !== "function") return null;
    return window.getObjectInstance(instanceId);
  }

  async function createMissingApothecaryInstance(object, item) {
    if (!object || !item || typeof window.createObjectInstance !== "function") {
      return null;
    }

    const livingState = item.livingState || {};
    const tendingEnabled = livingState.tending_enabled !== false;
    const tendingIntervalDays = Number(livingState.tending_interval_days || 30);
    const expirationEnabled = Boolean(livingState.expiration_enabled);
    const expirationDays = Number(livingState.expiration_days || 0);

    const instance = await window.createObjectInstance({
      entity_id: item.entityId || object.dataset.entityId || "",
      source: "apothecary",
      instance_type: "apothecary_item",
      name: item.name || object.dataset.label || "Apothecary Item",
      object_type: "apothecary",
      subtype: item.typeLabel || item.type || object.dataset.apothecaryType || "",
      apothecary_item_id: item.id || object.dataset.apothecaryItemId || "",
      tending_enabled: tendingEnabled,
      tending_interval_days: tendingEnabled ? tendingIntervalDays : null,
      expiration_enabled: expirationEnabled,
      expires_at:
        expirationEnabled && expirationDays > 0
          ? new Date(Date.now() + expirationDays * 86400000).toISOString()
          : null,
      metadata: {
        intention: item.intention || object.dataset.apothecaryIntention || "",
        notes: item.notes || object.dataset.apothecaryNotes || "",
        details: item.details || {},
        ingredients: item.ingredients || []
      }
    });

    if (!instance?.id) return null;

    if (typeof window.addObjectInstanceEvent === "function") {
      await window.addObjectInstanceEvent(instance.id, "created", {
        label: "Manifestation Created",
        notes: `Restored as a ${item.typeLabel || item.type || "apothecary item"}.`,
        metadata: { source: "living-state-repair" }
      });
    }

    item.instanceId = instance.id;

    if (
      typeof window.getApothecaryItems === "function" &&
      typeof window.saveApothecaryItems === "function"
    ) {
      const items = window.getApothecaryItems();
      await window.saveApothecaryItems(items);
    }

    return instance;
  }

  async function resolveMissingInstanceId(object) {
    if (!object) return null;

    const storedInstanceId = object.dataset.instanceId || "";
    const storedInstance = await getValidInstance(storedInstanceId);

    if (storedInstance) return storedInstance;
    if (storedInstanceId) object.dataset.instanceId = "";

    const apothecaryItemId = object.dataset.apothecaryItemId || "";
    const apothecaryItem =
      apothecaryItemId && typeof window.getApothecaryItemById === "function"
        ? window.getApothecaryItemById(apothecaryItemId)
        : null;

    if (apothecaryItem?.instanceId) {
      const itemInstance = await getValidInstance(apothecaryItem.instanceId);

      if (itemInstance) {
        object.dataset.instanceId = itemInstance.id;
        object.dataset.entityId =
          object.dataset.entityId || apothecaryItem.entityId || itemInstance.entity_id || "";
        window.saveWorkingAltarDraft?.();
        return itemInstance;
      }
    }

    const entityId = object.dataset.entityId || apothecaryItem?.entityId || "";

    if (entityId && typeof window.getObjectInstancesByEntity === "function") {
      const instances = await window.getObjectInstancesByEntity(entityId);

      if (Array.isArray(instances) && instances.length > 0) {
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

        if (matchedInstance?.id) {
          object.dataset.instanceId = matchedInstance.id;
          object.dataset.entityId = object.dataset.entityId || matchedInstance.entity_id || "";
          window.saveWorkingAltarDraft?.();
          return matchedInstance;
        }
      }
    }

    if (apothecaryItem) {
      const createdInstance = await createMissingApothecaryInstance(
        object,
        apothecaryItem
      );

      if (createdInstance?.id) {
        object.dataset.instanceId = createdInstance.id;
        object.dataset.entityId =
          object.dataset.entityId || apothecaryItem.entityId || createdInstance.entity_id || "";
        window.saveWorkingAltarDraft?.();
        return createdInstance;
      }
    }

    return null;
  }

  async function injectLivingStateIntoUnifiedCompanion(object, instance) {
    if (!object || !instance || typeof window.renderLivingStateMarkup !== "function") {
      return;
    }

    const events =
      typeof window.getObjectInstanceEvents === "function"
        ? await window.getObjectInstanceEvents(instance.id)
        : [];

    if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

    const companionPanel = document.querySelector(".altar-companion-panel");
    const page = companionPanel?.querySelector(".companion-v3-page");
    if (!page) return;

    page.querySelector("[data-companion-living-state]")?.remove();

    const template = document.createElement("template");
    template.innerHTML = window.renderLivingStateMarkup(instance, events);

    const livingSection = template.content.querySelector(".living-state-section");
    if (!livingSection) return;

    const wrapper = document.createElement("section");
    wrapper.className = "companion-v3-glance companion-v3-living-state";
    wrapper.setAttribute("data-companion-living-state", "");
    wrapper.innerHTML = livingSection.innerHTML;

    const knowledge = page.querySelector(".companion-v3-knowledge");
    if (knowledge) {
      page.insertBefore(wrapper, knowledge);
    } else {
      page.appendChild(wrapper);
    }
  }

  if (originalShowAltarCompanionPanel) {
    window.showAltarCompanionPanel = async function showCompanionWithLivingState(object) {
      if (!object) return;

      const instance = await resolveMissingInstanceId(object);
      originalShowAltarCompanionPanel(object);

      if (instance) {
        await injectLivingStateIntoUnifiedCompanion(object, instance);
      }
    };
  }

  /* The original selection function calls its local Companion function binding,
     so explicitly refresh the Companion after an altar-object click. */
  document.addEventListener("click", (event) => {
    const object = event.target.closest(".altar-object");
    if (!object) return;

    window.setTimeout(() => {
      if (typeof window.showAltarCompanionPanel === "function") {
        window.showAltarCompanionPanel(object);
      }
    }, 0);
  });

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
})();
