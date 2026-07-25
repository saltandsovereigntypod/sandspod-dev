/* =========================================================
   SELECTION INTERACTION GUARD
   Keeps the Companion click-driven, preserves mobile selection,
   and integrates Living State into the unified Companion page.
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

  function formatCompanionDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatDueLabel(value) {
    if (!value) return "";

    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return "";

    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return `${days} day${days === 1 ? "" : "s"} overdue`;
    }

    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";

    return `In ${diffDays} days`;
  }

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
      await window.saveApothecaryItems(window.getApothecaryItems());
    }

    return instance;
  }

  async function resolveMissingInstanceId(object) {
    if (!object) return null;

    const storedInstance = await getValidInstance(object.dataset.instanceId || "");
    if (storedInstance) return storedInstance;

    object.dataset.instanceId = "";

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
      const createdInstance = await createMissingApothecaryInstance(object, apothecaryItem);

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

  function buildCompactLivingStateMarkup(instance) {
    const status = String(instance.status || "active");
    const created = formatCompanionDate(instance.started_at);
    const nextTending = instance.tending_enabled && instance.tending_due_at
      ? formatCompanionDate(instance.tending_due_at)
      : "";
    const tendingDue = nextTending ? formatDueLabel(instance.tending_due_at) : "";
    const expiration = instance.expiration_enabled && instance.expires_at
      ? formatCompanionDate(instance.expires_at)
      : "";

    return `
      <section class="companion-v3-glance companion-v3-living-state-summary" data-companion-living-state>
        <div class="companion-v3-glance-group">
          <p class="companion-v3-living-meta">
            <strong>${status.toUpperCase()}</strong>
            ${created ? `<span aria-hidden="true"> · </span><span>Created ${created}</span>` : ""}
          </p>

          ${
            nextTending
              ? `<p><strong>Next tending:</strong> ${nextTending}${tendingDue ? ` <span class="altar-info-muted">(${tendingDue})</span>` : ""}</p>`
              : ""
          }

          ${expiration ? `<p><strong>Replace or review:</strong> ${expiration}</p>` : ""}
        </div>
      </section>
    `;
  }

  function integrateLivingStateIntoCompanion(object, instance) {
    if (!object || !instance) return;
    if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

    const page = document.querySelector(".altar-companion-panel .companion-v3-page");
    if (!page) return;

    page.querySelector("[data-companion-living-state]")?.remove();

    const knowledge = page.querySelector(".companion-v3-knowledge");
    const template = document.createElement("template");
    template.innerHTML = buildCompactLivingStateMarkup(instance);
    const summary = template.content.firstElementChild;

    if (summary) {
      if (knowledge) {
        page.insertBefore(summary, knowledge);
      } else {
        page.prepend(summary);
      }
    }

    let actions = page.querySelector(".companion-v3-actions");

    if (!actions) {
      actions = document.createElement("footer");
      actions.className = "companion-v3-actions";
      page.appendChild(actions);
    }

    actions.querySelector("[data-living-state-practice]")?.remove();

    if (instance.status !== "retired" && instance.status !== "archived") {
      const practiceButton = document.createElement("button");
      practiceButton.type = "button";
      practiceButton.className = "living-state-practice-button";
      practiceButton.setAttribute("data-living-state-practice", "");
      practiceButton.textContent = "✨ Begin Today’s Practice";
      actions.prepend(practiceButton);
    }
  }

  if (originalShowAltarCompanionPanel) {
    window.showAltarCompanionPanel = async function showCompanionWithLivingState(object) {
      if (!object) return;

      const instance = await resolveMissingInstanceId(object);
      originalShowAltarCompanionPanel(object);

      if (instance) {
        integrateLivingStateIntoCompanion(object, instance);
      }
    };
  }

  document.addEventListener("click", (event) => {
    const object = event.target.closest(".altar-object");
    if (!object) return;

    window.setTimeout(() => {
      window.showAltarCompanionPanel?.(object);
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
