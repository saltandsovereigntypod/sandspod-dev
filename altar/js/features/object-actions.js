/* =========================================================
   UNIFIED ALTAR OBJECT ACTIONS
   The canonical registry and bottom-toolbar renderer for selected objects.
   ========================================================= */

(function initializeObjectActions() {
  const MOBILE_QUERY = window.matchMedia("(max-width: 900px)");
  const CRAFTED_TYPES = new Set([
    "apothecary", "spell-jar", "oil", "incense", "sachet", "spray",
    "poppet", "powder", "tea", "herb-blend"
  ]);
  let overflowOpen = false;

  function currentObject(fallback = null) {
    return (typeof selectedObject !== "undefined" && selectedObject) ? selectedObject : fallback;
  }

  function objectType(object) {
    const raw = String(object?.dataset.apothecaryType || object?.dataset.type || "object")
      .trim().toLowerCase().replaceAll(" ", "-");
    if (object?.dataset.type === "apothecary") return "apothecary";
    return raw || "object";
  }

  function isCrafted(object) {
    return CRAFTED_TYPES.has(objectType(object)) || object?.dataset.type === "apothecary";
  }

  function snapshot() {
    if (typeof pushAltarUndoSnapshot === "function") pushAltarUndoSnapshot();
  }

  function escapeHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    if (typeof showAltarToast === "function") showAltarToast(message);
  }

  function refreshAfterAction(object) {
    if (!object?.isConnected) return;
    if (typeof updateToolbarNotes === "function") updateToolbarNotes(object);
    renderSelectedObjectActions(object);
    if (typeof refreshAltarCompanion === "function") {
      refreshAltarCompanion(object);
    } else {
      if (typeof scheduleCompanionV4 === "function") scheduleCompanionV4(object);
      if (typeof scheduleCompanionCurrentState === "function") scheduleCompanionCurrentState(object);
    }
  }

  function closeActionModal() {
    document.querySelector("[data-object-action-modal]")?.remove();
  }

  function openActionModal({ title, description = "", fields = [], submitLabel = "Save", onSubmit }) {
    closeActionModal();
    const modal = document.createElement("div");
    modal.className = "library-section-editor-modal object-action-modal";
    modal.setAttribute("data-object-action-modal", "");
    modal.innerHTML = `
      <div class="library-section-editor-card object-action-modal-card" role="dialog" aria-modal="true" aria-labelledby="object-action-title">
        <button type="button" class="library-section-editor-close" data-close-object-action aria-label="Close">×</button>
        <p class="eyebrow">Object Action</p>
        <h2 id="object-action-title">${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        <form data-object-action-form>
          ${fields.map((field) => `
            <label>
              ${escapeHtml(field.label)}
              ${field.type === "select" ? `
                <select name="${escapeHtml(field.name)}">
                  ${(field.options || []).map((option) => {
                    const value = typeof option === "string" ? option : option.value;
                    const label = typeof option === "string" ? option : option.label;
                    return `<option value="${escapeHtml(value)}" ${String(value) === String(field.value || "") ? "selected" : ""}>${escapeHtml(label)}</option>`;
                  }).join("")}
                </select>
              ` : field.type === "textarea" ? `
                <textarea name="${escapeHtml(field.name)}" rows="4">${escapeHtml(field.value || "")}</textarea>
              ` : `
                <input type="${escapeHtml(field.type || "text")}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.value || "")}" ${field.required ? "required" : ""}>
              `}
            </label>
          `).join("")}
          <button type="submit" class="button button--primary">${escapeHtml(submitLabel)}</button>
        </form>
      </div>
    `;

    const form = modal.querySelector("[data-object-action-form]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton.disabled) return;
      submitButton.disabled = true;
      try {
        const result = await onSubmit(new FormData(form));
        if (result === false) return;
        closeActionModal();
        refreshAfterAction(currentObject());
      } finally {
        if (submitButton.isConnected) submitButton.disabled = false;
      }
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-close-object-action]")) closeActionModal();
    });
    document.body.appendChild(modal);
    form.querySelector("input, textarea, select")?.focus();
  }

  function localDateTime(iso = "") {
    const date = new Date(iso || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function toIso(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function livingState(object) {
    return typeof getLivingObjectState === "function" ? getLivingObjectState(object) : null;
  }

  function openCandleDressingDialog(candle) {
    const ingredients = Array.from(document.querySelectorAll(".altar-object")).filter((item) => (
      item !== candle && typeof canDressCandle === "function" && canDressCandle(item)
    ));
    if (!ingredients.length) {
      showToast("Place a loose herb or oil on the altar first");
      return;
    }
    openActionModal({
      title: "Dress Candle",
      fields: [{
        name: "ingredient", label: "Herb or oil", type: "select",
        options: ingredients.map((item, index) => ({
          value: String(index), label: item.dataset.label || item.dataset.herb || "Ingredient"
        }))
      }],
      submitLabel: "Add Dressing",
      onSubmit(formData) {
        const ingredient = ingredients[Number(formData.get("ingredient"))];
        if (!ingredient) return false;
        snapshot();
        beginCandleDressing(ingredient);
        dressCandle(candle);
        showToast("Candle dressed");
        return true;
      }
    });
  }

  function openObjectEditDialog(object) {
    openActionModal({
      title: "Edit Object",
      fields: [{
        name: "label", label: "Display name", required: true,
        value: object.dataset.label || "Altar Object"
      }],
      onSubmit(formData) {
        const label = String(formData.get("label") || "").trim();
        if (!label) return false;
        snapshot();
        object.dataset.label = label;
        object.setAttribute("aria-label", `${label}. Click to select. Drag to move.`);
        if (typeof saveWorkingAltarDraft === "function") saveWorkingAltarDraft();
        showToast("Object updated");
      }
    });
  }

  function openCrystalAction(object, kind) {
    const state = livingState(object)?.crystal || {};
    if (kind === "dedication") {
      openActionModal({
        title: "Dedicate Crystal",
        fields: [{ name: "dedication", label: "Dedication", type: "textarea", value: state.dedication }],
        onSubmit(formData) {
          snapshot();
          setLivingCrystalCare(object, { dedication: String(formData.get("dedication") || "").trim() });
          showToast("Crystal dedication updated");
        }
      });
      return;
    }
    const isCleanse = kind === "cleanse";
    openActionModal({
      title: isCleanse ? "Cleanse Crystal" : "Charge Crystal",
      fields: [{
        name: "occurredAt", label: isCleanse ? "Cleansed at" : "Charged at",
        type: "datetime-local", value: localDateTime(isCleanse ? state.lastCleansedAt : state.lastChargedAt)
      }],
      onSubmit(formData) {
        const occurredAt = toIso(formData.get("occurredAt"));
        if (!occurredAt) return false;
        snapshot();
        setLivingCrystalCare(object, isCleanse ? { cleansedAt: occurredAt } : { chargedAt: occurredAt });
        showToast(isCleanse ? "Crystal cleansed" : "Crystal charged");
      }
    });
  }

  function openDeityAction(object, kind) {
    const state = livingState(object)?.deity || {};
    const definitions = {
      offering: {
        title: "Record Offering",
        fields: [
          { name: "lastOfferingAt", label: "Offered at", type: "datetime-local", value: localDateTime(state.lastOfferingAt) },
          { name: "offeringStatus", label: "Offering status", value: state.offeringStatus }
        ],
        values: (data) => ({
          lastOfferingAt: toIso(data.get("lastOfferingAt")),
          offeringStatus: String(data.get("offeringStatus") || "").trim()
        })
      },
      "offering-status": {
        title: "Offering Status",
        fields: [{ name: "offeringStatus", label: "Current status", value: state.offeringStatus }],
        values: (data) => ({ offeringStatus: String(data.get("offeringStatus") || "").trim() })
      },
      "reason-presence": {
        title: "Reason for Presence",
        fields: [{ name: "reasonForPresence", label: "Reason", type: "textarea", value: state.reasonForPresence }],
        values: (data) => ({ reasonForPresence: String(data.get("reasonForPresence") || "").trim() })
      }
    };
    const definition = definitions[kind];
    openActionModal({
      ...definition,
      onSubmit(formData) {
        const values = definition.values(formData);
        if (kind === "offering" && !values.lastOfferingAt) return false;
        snapshot();
        setLivingDeityState(object, values);
        showToast("Deity state updated");
      }
    });
  }

  async function saveCraftedLifecycle(object, stateValues, instanceValues = null) {
    snapshot();
    if (instanceValues && object.dataset.instanceId && typeof updateObjectInstance === "function") {
      const updated = await updateObjectInstance(object.dataset.instanceId, instanceValues);
      if (!updated) {
        showToast("Could not update this object instance");
        return false;
      }
    } else if (typeof setLivingApothecaryState === "function") {
      setLivingApothecaryState(object, stateValues);
    }
    if (typeof saveWorkingAltarDraft === "function") saveWorkingAltarDraft();
    showToast("Object state updated");
    return true;
  }

  function openCraftedAction(object, kind) {
    const state = livingState(object)?.apothecary || {};
    const definitions = {
      activation: {
        title: "Activation",
        fields: [{ name: "activationState", label: "Activation state", value: state.activationState }],
        values: (data) => ({ activationState: String(data.get("activationState") || "").trim() })
      },
      remaining: {
        title: "Remaining Amount",
        fields: [{ name: "remainingAmount", label: "Amount remaining", value: state.remainingAmount }],
        values: (data) => ({ remainingAmount: String(data.get("remainingAmount") || "").trim() })
      },
      review: {
        title: "Review / Expiration",
        fields: [
          { name: "nextTendingAt", label: "Next tending", type: "datetime-local", value: localDateTime(state.nextTendingAt) },
          { name: "reviewAt", label: "Review / expiration", type: "datetime-local", value: localDateTime(state.reviewAt) }
        ],
        values: (data) => ({
          nextTendingAt: toIso(data.get("nextTendingAt")),
          reviewAt: toIso(data.get("reviewAt"))
        })
      }
    };
    const definition = definitions[kind];
    openActionModal({
      ...definition,
      async onSubmit(formData) {
        const values = definition.values(formData);
        const instanceValues = kind === "remaining"
          ? { remaining_amount: values.remainingAmount || null }
          : kind === "review"
            ? {
              tending_due_at: values.nextTendingAt || null,
              tending_enabled: Boolean(values.nextTendingAt),
              expires_at: values.reviewAt || null,
              expiration_enabled: Boolean(values.reviewAt)
            }
            : null;
        return saveCraftedLifecycle(object, values, instanceValues);
      }
    });
  }

  const registry = [
    { id: "edit", label: "Edit", icon: "✎", priority: 10, types: ["*"], handler: openObjectEditDialog },
    { id: "light", label: (o) => o.dataset.lit === "true" ? "Extinguish" : "Light", icon: "🔥", priority: 12, types: ["candle"], handler: (o) => { snapshot(); toggleLight(o); } },
    { id: "dress-candle", label: "Dress", icon: "🌿", priority: 14, types: ["candle"], handler: openCandleDressingDialog },
    { id: "clear-dressings", label: "Undress", icon: "⌫", priority: 15, types: ["candle"], available: (o) => Boolean(livingState(o)?.candle?.dressings?.length), handler: (o) => { snapshot(); clearCandleDressings(o); } },
    { id: "cleanse", label: "Cleanse", icon: "💧", priority: 12, types: ["crystal"], handler: (o) => openCrystalAction(o, "cleanse") },
    { id: "charge", label: "Charge", icon: "☾", priority: 13, types: ["crystal"], handler: (o) => openCrystalAction(o, "charge") },
    { id: "dedicate", label: "Dedicate", icon: "✦", priority: 14, types: ["crystal"], handler: (o) => openCrystalAction(o, "dedication") },
    { id: "record-offering", label: "Offering", icon: "🎁", priority: 12, types: ["deity"], handler: (o) => openDeityAction(o, "offering") },
    { id: "offering-status", label: "Offering Status", icon: "◉", priority: 13, types: ["deity"], handler: (o) => openDeityAction(o, "offering-status") },
    { id: "reason-presence", label: "Reason", icon: "✎", priority: 14, types: ["deity"], handler: (o) => openDeityAction(o, "reason-presence") },
    { id: "edit-apothecary", label: "Edit Recipe", icon: "⚗", priority: 11, types: ["apothecary"], available: (o) => Boolean(o.dataset.apothecaryItemId && typeof openCreateApothecaryModal === "function"), handler: (o) => openCreateApothecaryModal("", o.dataset.apothecaryItemId) },
    { id: "begin-practice", label: "Begin Practice", icon: "✨", priority: 16, types: ["*"], available: (o) => Boolean(o.dataset.instanceId && typeof openLivingStatePracticeMenu === "function"), handler: () => openLivingStatePracticeMenu() },
    { id: "edit-practice", label: "Edit Practice", icon: "📝", priority: 17, types: ["*"], available: (o) => Boolean(o.dataset.entityId && typeof openLibrarySectionEditor === "function"), handler: (o) => openLibrarySectionEditor(o.dataset.entityId, "myPractice") },
    { id: "relationships", label: "Relationships", icon: "⛓", priority: 18, types: ["*"], available: (o) => Boolean(o.dataset.entityId && typeof openRelationshipManagerModal === "function"), handler: (o) => openRelationshipManagerModal(o.dataset.entityId) },
    { id: "history", label: "Full History", icon: "🕘", priority: 19, types: ["*"], available: (o) => Boolean(o.dataset.entityId && typeof openLivingHistoryModal === "function"), handler: (o) => openLivingHistoryModal(o.dataset.entityId) },
    { id: "activation", label: "Activation", icon: "✦", priority: 12, types: ["crafted"], handler: (o) => openCraftedAction(o, "activation") },
    { id: "remaining", label: "Remaining", icon: "◐", priority: 13, types: ["crafted"], handler: (o) => openCraftedAction(o, "remaining") },
    { id: "tend", label: "Tend", icon: "🌱", priority: 14, types: ["crafted"], available: (o) => Boolean(o.dataset.instanceId && typeof openLivingStateTendModal === "function"), handler: () => openLivingStateTendModal() },
    { id: "review", label: "Review", icon: "📅", priority: 15, types: ["crafted"], handler: (o) => openCraftedAction(o, "review") },
    { id: "duplicate", label: "Duplicate", icon: "⧉", priority: 30, types: ["*"], handler: (o) => duplicateObject(o) },
    { id: "lock", label: (o) => o.dataset.locked === "true" ? "Unlock" : "Lock", icon: "🔒", priority: 31, types: ["*"], handler: (o) => { snapshot(); toggleLock(o); } },
    { id: "glow", label: "Glow", icon: "✦", priority: 32, types: ["*"], handler: (o) => { snapshot(); toggleGlow(o); } },
    { id: "smaller", label: "Smaller", icon: "−", priority: 40, types: ["*"], available: (o) => o.dataset.locked !== "true", handler: (o) => { snapshot(); resizeObject(o, -0.1); } },
    { id: "larger", label: "Larger", icon: "+", priority: 41, types: ["*"], available: (o) => o.dataset.locked !== "true", handler: (o) => { snapshot(); resizeObject(o, 0.1); } },
    { id: "rotate-left", label: "Rotate Left", icon: "↺", priority: 42, types: ["*"], available: (o) => o.dataset.locked !== "true", handler: (o) => { snapshot(); rotateObject(o, -15); } },
    { id: "rotate-right", label: "Rotate Right", icon: "↻", priority: 43, types: ["*"], available: (o) => o.dataset.locked !== "true", handler: (o) => { snapshot(); rotateObject(o, 15); } },
    { id: "flip", label: "Flip", icon: "⇋", priority: 44, types: ["*"], available: (o) => o.dataset.locked !== "true", handler: (o) => { snapshot(); flipObject(o); } },
    { id: "forward", label: "Bring Forward", icon: "⬆", priority: 45, types: ["*"], handler: (o) => { snapshot(); bringForward(o); } },
    { id: "backward", label: "Send Backward", icon: "⬇", priority: 46, types: ["*"], handler: (o) => { snapshot(); sendBackward(o); } },
    { id: "ungroup", label: "Ungroup", icon: "⊟", priority: 47, types: ["*"], available: (o) => Boolean(o.dataset.groupId && typeof ungroupCurrentItems === "function"), handler: (o) => { snapshot(); ungroupCurrentItems(o.dataset.groupId); } },
    { id: "delete", label: "Delete", icon: "🗑", priority: 99, types: ["*"], handler: (o) => deleteObject(o) }
  ];

  function actionApplies(action, object) {
    const type = objectType(object);
    const typeMatches = action.types.includes("*") || action.types.includes(type) || (action.types.includes("crafted") && isCrafted(object));
    return typeMatches && (!action.available || action.available(object));
  }

  function getObjectActions(object = currentObject()) {
    if (!object) return [];
    return registry.filter((action) => actionApplies(action, object)).sort((a, b) => a.priority - b.priority);
  }

  function buttonMarkup(action, object, overflow = false) {
    const label = typeof action.label === "function" ? action.label(object) : action.label;
    return `<button type="button" data-action="${escapeHtml(action.id)}" ${overflow ? 'role="menuitem"' : ""} title="${escapeHtml(label)}"><span aria-hidden="true">${escapeHtml(action.icon)}</span><span>${escapeHtml(label)}</span></button>`;
  }

  function closeObjectActionOverflow() {
    overflowOpen = false;
    const popup = toolbar?.querySelector("[data-object-action-overflow]");
    const trigger = toolbar?.querySelector("[data-object-action-more]");
    if (popup) popup.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function renderSelectedObjectActions(object = currentObject()) {
    if (!toolbar || !altarActionBar) return;
    closeActionModal();
    closeObjectActionOverflow();
    altarActionBar.classList.toggle("has-object-selection", Boolean(object));
    if (!object) {
      toolbar.hidden = true;
      toolbar.replaceChildren();
      return;
    }

    const actions = getObjectActions(object);
    const visibleCount = MOBILE_QUERY.matches ? 3 : 5;
    const visible = actions.slice(0, visibleCount);
    const overflow = actions.slice(visibleCount);
    toolbar.innerHTML = `
      <div class="altar-object-actions-visible">${visible.map((action) => buttonMarkup(action, object)).join("")}</div>
      ${overflow.length ? `
        <div class="altar-object-actions-more-wrap">
          <button type="button" data-object-action-more aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">•••</span><span>See More</span></button>
          <div class="altar-object-actions-overflow" data-object-action-overflow role="menu" hidden>${overflow.map((action) => buttonMarkup(action, object, true)).join("")}</div>
        </div>
      ` : ""}
    `;
    toolbar.hidden = false;
  }

  async function executeSelectedObjectAction(actionId, object = currentObject()) {
    if (!object || !actionId) return false;
    if (actionId === "more") return false;
    const action = getObjectActions(object).find((candidate) => candidate.id === actionId);
    if (!action) return false;
    closeObjectActionOverflow();
    await action.handler(object);
    if (!document.querySelector("[data-object-action-modal]")) {
      refreshAfterAction(currentObject(object));
    }
    return true;
  }

  document.addEventListener("click", (event) => {
    const more = event.target.closest("[data-object-action-more]");
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      overflowOpen = !overflowOpen;
      const popup = toolbar.querySelector("[data-object-action-overflow]");
      popup.hidden = !overflowOpen;
      more.setAttribute("aria-expanded", String(overflowOpen));
      if (overflowOpen) popup.querySelector("button")?.focus();
      return;
    }
    if (overflowOpen && !event.target.closest(".altar-object-actions-more-wrap")) closeObjectActionOverflow();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeObjectActionOverflow();
    closeActionModal();
  });

  window.altarObjectActionRegistry = registry;
  window.getAltarObjectActions = getObjectActions;
  window.renderSelectedObjectActions = renderSelectedObjectActions;
  window.executeSelectedObjectAction = executeSelectedObjectAction;
  window.closeObjectActionOverflow = closeObjectActionOverflow;
})();
