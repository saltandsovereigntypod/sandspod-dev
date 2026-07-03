/* =========================================================
   8. SELECTION, INFO CARD, AND COMPANION PANEL
   ========================================================= */

let altarCompanionMinimized = false;

function getObjectIcon(object) {
  const type = object.dataset.type;

  if (type === "candle") return "🕯️";
  if (type === "herb") return "🌿";
  if (type === "oil") return "🧴";
  if (type === "crystal") return "💎";
  if (type === "deity") return "🗝️";
  if (type === "vessel") return "🏺";
  if (type === "tool") return "✦";
  if (type === "apothecary") return "🧪";

  return "✦";
}

function getObjectTypeLabel(object) {
  const type = object.dataset.type || "altar object";
  const form = object.dataset.form || "";

  if (object.dataset.type === "apothecary") {
    return object.dataset.apothecaryType || "apothecary item";
  }

  if (form && form !== "standard") {
    return `${type} · ${form}`;
  }

  return type;
}

function getApothecaryDetailsForObject(object) {
  if (!object || object.dataset.type !== "apothecary") return null;

  const itemId = object.dataset.apothecaryItemId || "";
  const savedItem =
    typeof getApothecaryItemById === "function" && itemId
      ? getApothecaryItemById(itemId)
      : null;

  let ingredients = [];

  try {
    ingredients = JSON.parse(object.dataset.apothecaryIngredients || "[]");
  } catch {
    ingredients = [];
  }

  return {
    itemId,
    name: savedItem?.name || object.dataset.label || "Apothecary Item",
    typeLabel: savedItem?.typeLabel || object.dataset.apothecaryType || "Apothecary Item",
    intention: savedItem?.intention || object.dataset.apothecaryIntention || "",
    notes: savedItem?.notes || object.dataset.apothecaryNotes || "",
    ingredients: savedItem?.ingredients || ingredients,
    logToGrimoire:
      savedItem?.logToGrimoire ||
      object.dataset.apothecaryLogToGrimoire === "true",
    grimoireStatus:
      savedItem?.grimoireStatus ||
      object.dataset.apothecaryGrimoireStatus ||
      ""
  };
}

function getCompanionDisplaySettings() {
  if (typeof getLocalMySettings !== "function") {
    return {
      companion_my_enabled: true,
      companion_my_ingredients: true,
      companion_my_intention: true,
      companion_my_notes: true,
      companion_my_grimoire: true,
      companion_my_dressings: true,
      companion_my_groups: true,

      companion_traditional_enabled: false,
      companion_community_enabled: false
    };
  }

  return getLocalMySettings();
}

function getLibraryEntityForObject(object) {
  if (!object) return null;

  const entityId = object.dataset.entityId;

  if (!entityId) return null;

  if (typeof Library === "undefined") return null;

  return Library.getEntity(entityId);
}

function buildObjectInfoMarkup(object, mode = "compact") {
  const label = object.dataset.label || "Altar Object";
  const typeLabel = getObjectTypeLabel(object);
  const entity = getLibraryEntityForObject(object);

  const entityData = entity || {
    traditional: {},
    myPractice: {},
    community: {}
  };
  const companionSettings = getCompanionDisplaySettings();
  const useSettings = mode === "panel";
  const activeGroup = object.dataset.groupId
    ? altarGroups.find((group) => group.id === object.dataset.groupId)
    : null;

  const dressings = getDressings(object);
  const oils = dressings
    .filter((dressing) => dressing.type === "oil")
    .map((dressing) => dressing.herb)
    .filter(Boolean);

  const herbs = dressings
    .filter((dressing) => dressing.type === "herb")
    .map((dressing) => dressing.herb)
    .filter(Boolean);

  const apothecaryDetails = getApothecaryDetailsForObject(object);

  const apothecaryMarkup = apothecaryDetails && (!useSettings || companionSettings.companion_my_enabled)  ? `
    <div class="altar-info-card-section">
      <p><strong>Type:</strong> ${apothecaryDetails.typeLabel}</p>

      ${
        apothecaryDetails.intention && (!useSettings || companionSettings.show_companion_my_intention)
          ? `<p><strong>Intention:</strong> ${apothecaryDetails.intention}</p>`
          : ""
      }

      ${
        apothecaryDetails.notes && (!useSettings || companionSettings.show_companion_my_notes)
          ? `<p><strong>Notes:</strong> ${apothecaryDetails.notes}</p>`
          : ""
      }

      ${
        apothecaryDetails.ingredients.length && (!useSettings || companionSettings.show_companion_my_ingredients)
          ? `
            <p><strong>Inside:</strong></p>
            <p>${apothecaryDetails.ingredients.map((ingredient) => ingredient.label).join(", ")}</p>
          `
          : ""
      }

      ${
        apothecaryDetails.logToGrimoire && (!useSettings || companionSettings.show_companion_my_grimoire)
          ? `<p><strong>Grimoire:</strong> ${apothecaryDetails.grimoireStatus || "ready to log"}</p>`
          : ""
      }
    </div>

    <div class="altar-info-card-section altar-info-card-actions">
      <button type="button" data-apothecary-edit="${apothecaryDetails.itemId}">Edit</button>
      <button type="button" data-apothecary-delete="${apothecaryDetails.itemId}">Delete</button>
    </div>
  `
  : "";

  const dressingMarkup =
    (oils.length || herbs.length) && (!useSettings || companionSettings.show_companion_my_dressings)
      ? `
        <div class="altar-info-card-section">
          <p><strong>Dressing</strong></p>
          ${oils.length ? `<p><strong>Oil:</strong> ${oils.join(", ")}</p>` : ""}
          ${herbs.length ? `<p><strong>Herb:</strong> ${herbs.join(", ")}</p>` : ""}
        </div>
      `
      : "";

  const groupItems = activeGroup
    ? getGroupObjects(activeGroup.id).map((item) => item.dataset.label || "Item")
    : [];

  const groupMarkup =
    activeGroup && (!useSettings || companionSettings.show_companion_my_groups)
      ? `
        <div class="altar-info-card-section">
          <p><strong>Group:</strong> ${activeGroup.name}</p>
          <p>${groupItems.join(", ")}</p>
        </div>
      `
      : "";

  return `
    <div class="altar-info-card-inner ${mode === "panel" ? "is-panel-view" : ""}">
      <h3>${getObjectIcon(object)} ${label}</h3>
      <p class="altar-info-card-type">${typeLabel}</p>

      ${
        mode === "panel" && companionSettings.companion_traditional_enabled !== false
          ? `
            <div class="altar-info-card-section">
              <h4>Traditional</h4>
              ${
                Object.keys(entityData.traditional || {}).length
                  ? Object.entries(entityData.traditional)
                      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                      .join("")
                  : `<p class="altar-info-empty">No traditional information yet.</p>`
              }
            </div>
          `
          : ""
      }

      ${
        mode === "panel" && companionSettings.companion_my_enabled !== false
          ? `
            <div class="altar-info-card-section">
              <h4>My Practice</h4>
              ${
                Object.keys(entityData.myPractice || {}).length
                  ? Object.entries(entityData.myPractice)
                      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                      .join("")
                  : `<p class="altar-info-empty">Nothing added yet.</p>`
              }

              ${
                entity?.id
                  ? `<button type="button" class="altar-companion-edit-button" data-library-edit-section="myPractice" data-library-entity-id="${entity.id}">Edit My Practice</button>`
                  : ""
              }
            </div>
          `
          : ""
      }

      ${
        mode === "panel" && companionSettings.companion_community_enabled !== false
          ? `
            <div class="altar-info-card-section">
              <h4>Community</h4>
              ${
                Object.keys(entityData.community || {}).length
                  ? Object.entries(entityData.community)
                      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                      .join("")
                  : `<p class="altar-info-empty">No community knowledge yet.</p>`
              }
            </div>
          `
          : ""
      }

      ${groupMarkup}
      ${apothecaryMarkup}
      ${dressingMarkup}
    </div>
  `;
}

function showAltarCompanionPanel(object) {
  if (!altarCompanionPanel || !object) return;

  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");
  if (!companionContent) return;

  companionContent.innerHTML = buildObjectInfoMarkup(object, "panel");

  if (!altarCompanionMinimized) {
    altarCompanionPanel.classList.add("is-visible");
    altarCompanionPanel.classList.remove("is-minimized");
  }
}

function hideAltarCompanionPanel() {
  if (!altarCompanionPanel) return;

  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");
  if (!companionContent) return;

  companionContent.innerHTML = `<p>Select an object to see its details.</p>`;
}

function showAltarInfoCard(object) {
  if (!altarInfoCard || !object) return;

  altarInfoCard.innerHTML = buildObjectInfoMarkup(object, "compact");

  altarInfoCard.hidden = false;
  altarInfoCard.classList.add("is-visible");

  showAltarCompanionPanel(object);
}

function hideAltarInfoCard() {
  if (!altarInfoCard) return;

  altarInfoCard.classList.remove("is-visible");

  window.setTimeout(() => {
    if (!altarInfoCard.classList.contains("is-visible")) {
      altarInfoCard.hidden = true;
    }
  }, 180);

  hideAltarCompanionPanel();
}

function updateToolbarNotes(object) {
  let notes = toolbar.querySelector(".altar-toolbar-notes");

  if (!notes) {
    notes = document.createElement("div");
    notes.className = "altar-toolbar-notes";
    toolbar.appendChild(notes);
  }

  if (!object || object.dataset.type !== "candle") {
    notes.hidden = true;
    notes.textContent = "";
    return;
  }

  const dressings = getDressings(object);

  if (dressings.length === 0) {
    notes.hidden = true;
    notes.textContent = "";
    return;
  }

  notes.hidden = false;
  notes.textContent = `Dressed with: ${dressings
    .map(formatDressingName)
    .join(", ")}`;
}

function selectObject(object) {
  if (!object) return;

  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = object;
  selectedObject.classList.add("is-selected");

  toolbar.hidden = false;

  updateToolbarNotes(selectedObject);
  showAltarInfoCard(selectedObject);
  updateSelectedGroupVisuals(selectedObject);
}

function deselectObject() {
  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = null;
  toolbar.hidden = true;

  updateToolbarNotes(null);
  hideAltarInfoCard();
  updateSelectedGroupVisuals(null);
}

document.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-companion-toggle], [data-companion-minimize]");

  if (!toggleButton || !altarCompanionPanel) return;

  altarCompanionMinimized = !altarCompanionMinimized;

  altarCompanionPanel.classList.toggle("is-minimized", altarCompanionMinimized);

  document.body.classList.toggle("altar-companion-minimized", altarCompanionMinimized);

  document.querySelectorAll("[data-companion-toggle], [data-companion-minimize]").forEach((button) => {
    button.textContent = altarCompanionMinimized ? "☰" : "−";
    button.setAttribute(
      "aria-label",
      altarCompanionMinimized ? "Open companion panel" : "Minimize companion panel"
    );
  });

  requestAnimationFrame(() => {
    repositionAllObjectsFromPercent();
    resizeLightingCanvas();
    renderLighting();
  });

  showAltarToast(altarCompanionMinimized ? "Companion minimized" : "Companion opened");
});

function openLibrarySectionEditor(entityId, section) {
  if (typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  const existing = entity[section] || {};
  const sectionLabel =
    section === "traditional"
      ? "Traditional"
      : section === "myPractice"
        ? "My Practice"
        : "Library";

  const modal = document.createElement("div");
  modal.className = "library-section-editor-modal";
  modal.setAttribute("data-library-section-editor", "");

  modal.innerHTML = `
    <div class="library-section-editor-card" role="dialog" aria-modal="true" aria-label="Edit ${sectionLabel}">
      <button class="library-section-editor-close" type="button" data-close-library-section-editor aria-label="Close">
        ×
      </button>

      <p class="eyebrow">${sectionLabel}</p>
      <h2>${entity.name}</h2>

      <form data-library-section-form data-library-entity-id="${entity.id}" data-library-section="${section}">
        <label>
          Meaning
          <textarea name="Meaning" rows="3">${existing.Meaning || ""}</textarea>
        </label>

        <label>
          Uses
          <textarea name="Uses" rows="3">${existing.Uses || ""}</textarea>
        </label>

        <label>
          Pairs With
          <textarea name="PairsWith" rows="2">${existing.PairsWith || ""}</textarea>
        </label>

        <label>
          Substitutions
          <textarea name="Substitutions" rows="2">${existing.Substitutions || ""}</textarea>
        </label>

        <label>
          Notes
          <textarea name="Notes" rows="4">${existing.Notes || ""}</textarea>
        </label>

        <button class="button button--primary" type="submit">
          Save ${sectionLabel}
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("altar-modal-open");
}

function closeLibrarySectionEditor() {
  const modal = document.querySelector("[data-library-section-editor]");
  if (!modal) return;

  modal.remove();
  document.body.classList.remove("altar-modal-open");
}

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-library-edit-section]");
  const closeButton = event.target.closest("[data-close-library-section-editor]");
  const modal = event.target.closest("[data-library-section-editor]");

  if (editButton) {
    openLibrarySectionEditor(
      editButton.dataset.libraryEntityId,
      editButton.dataset.libraryEditSection
    );
  }

  if (closeButton) {
    closeLibrarySectionEditor();
  }

  if (modal && event.target === modal) {
    closeLibrarySectionEditor();
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-library-section-form]");
  if (!form) return;

  event.preventDefault();

  const entityId = form.dataset.libraryEntityId;
  const section = form.dataset.librarySection;

  const formData = new FormData(form);

  const changes = {
    Meaning: String(formData.get("Meaning") || "").trim(),
    Uses: String(formData.get("Uses") || "").trim(),
    PairsWith: String(formData.get("PairsWith") || "").trim(),
    Substitutions: String(formData.get("Substitutions") || "").trim(),
    Notes: String(formData.get("Notes") || "").trim()
  };

  Object.keys(changes).forEach((key) => {
    if (!changes[key]) {
      delete changes[key];
    }
  });

  Library.updateEntitySection(entityId, section, changes);

  closeLibrarySectionEditor();

  if (selectedObject && selectedObject.dataset.entityId === entityId) {
    showAltarInfoCard(selectedObject);
  }

  showAltarToast("Library updated");
});