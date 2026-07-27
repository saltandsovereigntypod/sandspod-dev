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

  function optionCards(name, options, multiple = false, selected = []) {
    const chosen = new Set(Array.isArray(selected) ? selected : [selected]);
    return `<div class="object-workflow-options">${options.map((label) => {
      const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `<label><input type="${multiple ? "checkbox" : "radio"}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${multiple ? "" : "required"} ${chosen.has(value) ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
    }).join("")}</div>`;
  }

  function resourceChoices(subject) {
    return Array.from(document.querySelectorAll(".altar-object"))
      .filter((item) => item !== subject && ["herb", "oil", "incense", "crystal", "candle", "apothecary"].includes(item.dataset.type))
      .map((item) => ({ id: item.dataset.altarObjectId || item.dataset.entityId || item.dataset.label, label: item.dataset.label || "Altar support" }));
  }

  function supportCards(subject) {
    const supports = resourceChoices(subject);
    if (!supports.length) return `<p class="object-workflow-muted">Place herbs, oils, incense, crystals, candles, or apothecary items on the altar to select them here.</p>`;
    return `<div class="object-workflow-options object-workflow-supports">${supports.map((support) => `<label><input type="checkbox" name="supports" value="${escapeHtml(support.id)}" data-support-label="${escapeHtml(support.label)}"><span>${escapeHtml(support.label)}</span></label>`).join("")}</div>`;
  }

  function openWorkflowModal({ title, intro, content, submitLabel, onSubmit }) {
    closeActionModal();
    const modal = document.createElement("div");
    modal.className = "library-section-editor-modal object-action-modal object-workflow-modal";
    modal.setAttribute("data-object-action-modal", "");
    modal.innerHTML = `<div class="library-section-editor-card object-action-modal-card object-workflow-card" role="dialog" aria-modal="true"><button type="button" class="library-section-editor-close" data-close-object-action aria-label="Close">×</button><p class="eyebrow">Guided Ritual</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(intro)}</p><form data-object-action-form>${content}<button type="submit" class="button button--primary">${escapeHtml(submitLabel)}</button></form></div>`;
    const form = modal.querySelector("form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const result = await onSubmit(new FormData(form), form);
        if (result === false) return;
        closeActionModal();
        refreshAfterAction(currentObject());
      } finally { if (button.isConnected) button.disabled = false; }
    });
    modal.addEventListener("click", (event) => { if (event.target === modal || event.target.closest("[data-close-object-action]")) closeActionModal(); });
    modal.addEventListener("change", (event) => {
      if (event.target.name !== "duration") return;
      const review = modal.querySelector("[data-dedication-review]");
      if (review) review.hidden = !["until-a-chosen-date", "ongoing-but-review-later"].includes(event.target.value);
    });
    document.body.appendChild(modal);
  }

  function selectedValues(data, name) { return data.getAll(name).map(String); }
  function selectedSupportRecords(form) {
    return Array.from(form.querySelectorAll('input[name="supports"]:checked')).map((input) => ({ id: input.value, label: input.dataset.supportLabel || input.value }));
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
      const entities = typeof Library !== "undefined" && typeof Library.getAllEntitiesSorted === "function" ? Library.getAllEntitiesSorted() : [];
      openWorkflowModal({
        title: "Dedicate Crystal", intro: "Assign this crystal an ongoing spiritual role, relationship, or devotional focus.", submitLabel: "Save Dedication",
        content: `<section><h3>1. Dedication type</h3>${optionCards("dedicationType", ["Deity", "Ancestor", "Spirit", "Purpose", "Ritual role", "Person", "Self", "Place", "Practice", "Other"])}</section><section><h3>2. Dedicated to</h3><select name="entityId"><option value="">Custom or none</option>${entities.map((entity) => `<option value="${escapeHtml(entity.id)}">${escapeHtml(entity.name)} · ${escapeHtml(entity.type)}</option>`).join("")}</select><input name="dedicatedTo" placeholder="Custom name or focus" value="${escapeHtml(state.dedicationDetails?.dedicatedTo || "")}"></section><section><h3>3. Dedication intention</h3><textarea name="intention" rows="4">${escapeHtml(state.dedicationDetails?.intention || state.dedication || "")}</textarea></section><section><h3>4. Duration</h3>${optionCards("duration", ["Until manually removed", "For one ritual", "Until a chosen date", "Ongoing but review later"], false, state.dedicationDetails?.duration || "until-manually-removed")}<label data-dedication-review ${["until-a-chosen-date", "ongoing-but-review-later"].includes(state.dedicationDetails?.duration) ? "" : "hidden"}>Review or end date<input type="date" name="reviewAt" value="${escapeHtml(state.dedicationDetails?.reviewAt?.slice?.(0, 10) || "")}"></label></section><section><h3>5. Reflection</h3><textarea name="notes" rows="3" placeholder="Optional notes">${escapeHtml(state.dedicationDetails?.notes || "")}</textarea></section>`,
        async onSubmit(formData) {
          const entity = entities.find((item) => item.id === formData.get("entityId"));
          const details = { type: formData.get("dedicationType"), entityId: formData.get("entityId"), dedicatedTo: String(formData.get("dedicatedTo") || entity?.name || "").trim(), intention: String(formData.get("intention") || "").trim(), duration: formData.get("duration"), reviewAt: formData.get("reviewAt") || "", notes: String(formData.get("notes") || "").trim(), recordedAt: new Date().toISOString() };
          snapshot();
          setLivingCrystalCare(object, { dedication: details.intention || details.dedicatedTo, dedicationDetails: details });
          showToast("Crystal dedication updated");
        }
      });
      return;
    }
    const isCleanse = kind === "cleanse";
    const reasons = isCleanse ? ["General energetic cleansing", "Clearing a current intention", "Preparing for a new intention", "After ritual use", "After emotionally intense use", "Routine care", "Other"] : ["General recharge", "Strengthen current intention", "Prepare for ritual", "Prepare for meditation", "Protection", "Healing", "Divination", "Manifestation", "Devotional use", "Seasonal or lunar work", "Other"];
    const methods = isCleanse ? ["Moonlight", "Sunlight", "Water", "Salt", "Smoke", "Sound", "Selenite", "Earth", "Herbs", "Breath", "Visualization", "Prayer", "Intention", "Other"] : ["Moonlight", "Sunlight", "Crystal grid", "Another crystal", "Herbs", "Oil", "Candle", "Sound", "Breath", "Visualization", "Prayer", "Intention", "Altar placement", "Other"];
    const currentIntention = state.dedicationDetails?.intention || state.dedication || "";
    const handling = isCleanse ? ["Keep the current intention", "Clear the current intention", "Replace it after cleansing"] : ["Keep and strengthen the current intention", "Cleanse the current intention first", "Replace with a new intention", "Charge without changing the intention"];
    openWorkflowModal({
      title: isCleanse ? "Cleanse Crystal" : "Charge Crystal", intro: isCleanse ? "Record the purpose, methods, and supports used in this cleansing." : "Shape and record the purpose of this crystal charge.", submitLabel: isCleanse ? "Complete Cleansing" : "Complete Charge",
      content: `<section><h3>1. ${isCleanse ? "Reason for cleansing" : "Purpose of the charge"}</h3>${optionCards("purpose", reasons)}</section><section><h3>2. ${isCleanse ? "Cleansing" : "Charging"} methods</h3>${optionCards("methods", methods, true)}</section><section><h3>3. Supports used</h3>${supportCards(object)}</section>${currentIntention ? `<section class="object-workflow-current"><h3>4. Current intention</h3><p>${escapeHtml(currentIntention)}</p>${optionCards("intentionHandling", handling)}</section>` : ""}${(!isCleanse || currentIntention) ? `<section><h3>${currentIntention ? "5" : "4"}. New or strengthened intention</h3><textarea name="newIntention" rows="3"></textarea></section>` : ""}<section><h3>Reflection</h3><textarea name="notes" rows="3" placeholder="Optional notes or reflection"></textarea></section><label>Completed at<input type="datetime-local" name="occurredAt" value="${localDateTime()}"></label>`,
      async onSubmit(formData, form) {
        const occurredAt = toIso(formData.get("occurredAt"));
        if (!occurredAt) return false;
        if (!formData.getAll("methods").length) { showToast("Choose at least one method"); return false; }
        const record = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), occurredAt, purpose: formData.get("purpose"), methods: selectedValues(formData, "methods"), supports: selectedSupportRecords(form), intentionHandling: formData.get("intentionHandling") || "", intention: String(formData.get("newIntention") || "").trim(), notes: String(formData.get("notes") || "").trim() };
        snapshot();
        const clear = record.intentionHandling === "clear-the-current-intention";
        const replace = record.intention && ["replace-with-a-new-intention", "replace-it-after-cleansing"].includes(record.intentionHandling);
        const strengthen = record.intention && record.intentionHandling === "keep-and-strengthen-the-current-intention";
        const care = isCleanse ? { cleansedAt: occurredAt, cleansingRecord: record } : { chargedAt: occurredAt, chargingRecord: record };
        if (clear) { care.dedication = ""; care.dedicationDetails = null; }
        if (replace || strengthen) {
          care.dedication = record.intention;
          care.dedicationDetails = { ...(state.dedicationDetails || {}), intention: record.intention, updatedAt: occurredAt };
        }
        setLivingCrystalCare(object, care);
        showToast(isCleanse ? "Crystal cleansed" : "Crystal charged");
      }
    });
  }

  function openDeityAction(object, kind) {
    const state = livingState(object)?.deity || {};
    const statuses = ["Offered", "Present on altar", "Completed", "Consumed or used", "Removed", "Returned to nature", "Disposed of", "Unknown", "Custom"];
    if (kind === "offering-status") {
      const latest = state.offerings?.[state.offerings.length - 1];
      if (!latest) { showToast("Record an offering before updating its status"); openDeityAction(object, "offering"); return; }
      openWorkflowModal({ title: "Update Offering Status", intro: `Updating: ${(latest.items || []).map((item) => item.label || item).join(", ") || "latest offering"}`, submitLabel: "Update Status", content: `<section><h3>Devotional state</h3>${optionCards("status", statuses, false, latest.status)}</section><label>Custom status<input name="customStatus"></label>`, async onSubmit(data) {
        const status = data.get("status") === "custom" ? String(data.get("customStatus") || "").trim() : data.get("status");
        const occurredAt = new Date().toISOString();
        snapshot(); setLivingDeityState(object, { offeringStatus: status, updateLatestOffering: { status, statusUpdatedAt: occurredAt }, offeringStatusRecord: { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), offeringId: latest.id, status, occurredAt } });
      }});
      return;
    }
    if (kind === "reason-presence") {
      const reasons = ["Devotional focus", "Ritual participant", "Protection", "Guidance", "Honoring or remembrance", "Seasonal observance", "Ongoing altar presence", "Temporary presence", "Other"];
      openWorkflowModal({ title: "Reason for Presence", intro: "Describe the role this presence holds on the digital altar.", submitLabel: "Save Reason", content: `<section><h3>Primary reason</h3>${optionCards("reason", reasons, false, state.reasonDetails?.reason)}</section><label>Expanded notes<textarea name="notes" rows="4">${escapeHtml(state.reasonDetails?.notes || state.reasonForPresence || "")}</textarea></label>`, onSubmit(data) {
        const details = { reason: data.get("reason"), notes: String(data.get("notes") || "").trim(), updatedAt: new Date().toISOString() };
        snapshot();
        setLivingDeityState(object, { reasonForPresence: [details.reason?.replaceAll("-", " "), details.notes].filter(Boolean).join(": "), reasonDetails: details });
      }});
      return;
    }
    openWorkflowModal({ title: `Offering for ${object.dataset.label || "Selected Deity"}`, intro: "Record the devotional meaning and current state of this offering without treating interpretation as objective fact.", submitLabel: "Record Offering", content: `<section><h3>1. Offering types</h3>${optionCards("types", ["Herbs", "Crystals", "Oils", "Apothecary items", "Incense", "Candles", "Food", "Drink", "Flowers", "Coins", "Written prayer", "Song or music", "Devotional act", "Other"], true)}</section><section><h3>2. Specific offerings</h3>${supportCards(object)}<label>Other offerings<input name="customItems" placeholder="Comma-separated"></label></section><section><h3>3. Intention</h3><input name="intention" placeholder="Gratitude, petition, devotion, celebration…"><textarea name="message" rows="3" placeholder="Optional prayer or message"></textarea></section><section><h3>4. Offering status</h3>${optionCards("status", statuses, false, "offered")}<input name="customStatus" placeholder="Custom status"></section><section><h3>5. Perceived response</h3>${optionCards("response", ["Not yet known", "Accepted", "Neutral", "Declined", "Strong presence felt", "Personal interpretation"])}<textarea name="responseNotes" rows="3" placeholder="Optional personal interpretation"></textarea></section><label>Offered at<input type="datetime-local" name="occurredAt" value="${localDateTime()}"></label>`, async onSubmit(data, form) {
      const occurredAt = toIso(data.get("occurredAt")); if (!occurredAt) return false;
      const custom = String(data.get("customItems") || "").split(",").map((value) => value.trim()).filter(Boolean).map((label) => ({ label, custom: true }));
      const status = data.get("status") === "custom" ? String(data.get("customStatus") || "").trim() : data.get("status");
      const record = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), occurredAt, types: selectedValues(data, "types"), items: [...selectedSupportRecords(form), ...custom], intention: String(data.get("intention") || "").trim(), message: String(data.get("message") || "").trim(), status, perceivedResponse: data.get("response") || "", responseNotes: String(data.get("responseNotes") || "").trim() };
      snapshot(); setLivingDeityState(object, { lastOfferingAt: occurredAt, offeringStatus: status, offeringRecord: record });
      showToast("Offering recorded");
    }});
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
