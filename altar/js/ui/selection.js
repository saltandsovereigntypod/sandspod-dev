/* =========================================================
   8. SELECTION, INFO CARD, AND COMPANION PANEL
   ========================================================= */

let altarCompanionMinimized = false;
let altarLivingStateMinimized = false;

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
  const settings =
    typeof getLocalMySettings === "function"
      ? getLocalMySettings()
      : {};

  if (settings.companion_copy_grimoire_settings) {
    return settings;
  }

  const mappedSettings = { ...settings };

  mappedSettings.library_layer_order =
    settings.companion_layer_order || "myPractice,traditional,community";

  ["my", "traditional", "community"].forEach((layer) => {
    const libraryLayer = layer === "my" ? "myPractice" : layer;

    mappedSettings[`library_${libraryLayer}_enabled`] =
      Boolean(settings[`companion_${layer}_enabled`]);

    [
      "meanings",
      "uses",
      "correspondences",
      "ingredients",
      "intentions",
      "pairings",
      "substitutions",
      "warnings",
      "grimoire",
      "dressings",
      "groups",
      "notes",
      "sources"
    ].forEach((field) => {
      mappedSettings[`library_${libraryLayer}_${field}`] =
        Boolean(settings[`companion_${layer}_${field}`]);
    });
  });

  return mappedSettings;
}

function getLibraryEntityForObject(object) {
  if (!object) return null;

  const entityId = object.dataset.entityId;

  if (!entityId) return null;

  if (typeof Library === "undefined") return null;

  return Library.getEntity(entityId);
}

function renderCompanionLibraryEntity(entity, settings = {}) {
  const layerOrder = String(settings.library_layer_order || "myPractice,traditional,community")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function fieldCategory(key = "") {
    const categories = {
      Meaning: "meanings",
      Meanings: "meanings",
      Uses: "uses",
      Domains: "uses",
      Purpose: "uses",
      Element: "correspondences",
      Planet: "correspondences",
      Chakra: "correspondences",
      Pantheon: "correspondences",
      Ingredients: "ingredients",
      Intention: "intentions",
      Intentions: "intentions",
      PairsWith: "pairings",
      BestWith: "pairings",
      Substitutions: "substitutions",
      TraditionalWarnings: "warnings",
      Warnings: "warnings",
      GrimoireStatus: "grimoire",
      CandleDressings: "dressings",
      Groups: "groups",
      Notes: "notes",
      Sources: "sources",
      Source: "sources"
    };

    return categories[key] || "notes";
  }

  function shouldShowField(layer, key) {
    const category = fieldCategory(key);
    return settings[`library_${layer}_${category}`] !== false;
  }

  function renderCompanionFieldValue(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item && typeof item === "object") {
            const amount = item.amount ? `${item.amount} ` : "";
            const name = item.libraryName || item.label || item.name || "Ingredient";
            return `${amount}${name}`.trim();
          }

          return item;
        })
        .filter(Boolean)
        .join(", ");
    }

    if (value && typeof value === "object") {
      return value.label || value.name || JSON.stringify(value);
    }

    return value;
  }

  function renderLayer(title, layer, data = {}) {
    if (settings[`library_${layer}_enabled`] === false) return "";

    const entries = Object.entries(data).filter(([key, value]) => {
      if (key === "tags") return false;
      if (!value) return false;
      return shouldShowField(layer, key);
    });

    if (!entries.length) return "";

    return `
      <div class="altar-info-card-section">
        <p><strong>${title}</strong></p>

        ${entries
          .map(([key, value]) => `
            <p>
              <strong>${String(key).replaceAll("_", " ")}:</strong>
              ${renderCompanionFieldValue(value)}
            </p>
          `)
          .join("")}
      </div>
    `;
  }

  const layers = layerOrder
    .map((layer) => {
      if (layer === "myPractice") {
        return renderLayer("My Practice", "myPractice", entity.myPractice || {});
      }

      if (layer === "traditional") {
        return renderLayer("Traditional", "traditional", entity.traditional || {});
      }

      if (layer === "community") {
        return renderLayer("Community", "community", entity.community || {});
      }

      return "";
    })
    .join("");

  return `
    <div class="altar-info-card-inner is-panel-view">
      <h3>${entity.name || "Library Entry"}</h3>
      <p class="altar-info-card-type">${entity.type || "entry"}</p>
      ${layers || `<p>Select an object to see its details.</p>`}
    </div>
  `;
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
  const libraryEntity =
    object.dataset.entityId && typeof Library !== "undefined"
      ? Library.getEntity(object.dataset.entityId)
      : null;

  if (mode === "panel" && libraryEntity && typeof renderCompanionLibraryEntity === "function") {
    return renderCompanionLibraryEntity(libraryEntity, companionSettings);
  }

  if (mode === "panel" && entity && typeof renderCompanionLibraryEntity === "function") {
    return renderCompanionLibraryEntity(entity, companionSettings);
  }
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

function formatLivingStateDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatLivingStateDue(value) {
  if (!value) return "";

  const dueDate = new Date(value);
  const now = new Date();

  if (Number.isNaN(dueDate.getTime())) return "";

  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
  if (diffDays === 0) return "Due today";
  return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function renderLivingStateEventIcon(eventType = "") {
  const icons = {
    created: "✦",
    fed: "🌿",
    tended: "🕯",
    used: "✧",
    moved: "↝",
    lit: "🔥",
    extinguished: "💨",
    retired: "☾",
    archived: "✶",
    replaced: "↻"
  };

  return icons[eventType] || "✦";
}

function renderLivingStateRecentActivity(events = []) {
  const latestEvent = events[0];

  if (!latestEvent) {
    return `
      <div class="altar-info-card-section living-state-history">
        <p><strong>Recent Activity</strong></p>
        <p>No activity recorded yet.</p>
      </div>
    `;
  }

function renderLivingStateRecentActivity(events = []) {
  const latestEvent = events[0];

  if (!latestEvent) {
    return `
      <div class="altar-info-card-section living-state-history">
        <p><strong>Recent Activity</strong></p>
        <p>No activity recorded yet.</p>
      </div>
    `;
  }

  return `
    <div class="altar-info-card-section living-state-history">
      <p><strong>Recent Activity</strong></p>

      <div class="living-state-event">
        <p>
          <span aria-hidden="true">${renderLivingStateEventIcon(latestEvent.event_type)}</span>
          <strong>${latestEvent.event_label || latestEvent.event_type || "Event"}</strong>
        </p>

        <p>${formatLivingStateDate(latestEvent.occurred_at)}</p>

        ${
          latestEvent.event_notes
            ? `<p>${latestEvent.event_notes}</p>`
            : ""
        }
      </div>
    </div>
  `;
}

  return `
    <div class="altar-info-card-section living-state-history">
      <p><strong>Living History</strong></p>

      ${events
        .map((event) => `
          <div class="living-state-event">
            <p>
              <span aria-hidden="true">${renderLivingStateEventIcon(event.event_type)}</span>
              <strong>${event.event_label || event.event_type || "Event"}</strong>
            </p>

            <p>${formatLivingStateDate(event.occurred_at)}</p>

            ${
              event.event_notes
                ? `<p>${event.event_notes}</p>`
                : ""
            }
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderLivingStateMarkup(instance, events = []) {
  if (!instance) {
    return `<p>No living state has been created for this object yet.</p>`;
  }

  return `
    <div class="altar-info-card-inner is-panel-view">
      <h3>${instance.name || "Current Manifestation"}</h3>
      <p class="altar-info-card-type">${instance.subtype || instance.object_type || "Living State"}</p>

      <div class="altar-info-card-section">
        <p><strong>Status:</strong> ${instance.status || "active"}</p>
        ${instance.started_at ? `<p><strong>Created:</strong> ${formatLivingStateDate(instance.started_at)}</p>` : ""}
        ${instance.source ? `<p><strong>Source:</strong> ${instance.source}</p>` : ""}
        ${
          instance.metadata?.last_tended_at
            ? `<p><strong>Last Tended:</strong> ${formatLivingStateDate(instance.metadata.last_tended_at)}</p>`
            : ""
        }
      </div>

      ${
        instance.expiration_enabled && instance.expires_at
          ? `
            <div class="altar-info-card-section">
              <p><strong>Expiration Reminder:</strong> ${formatLivingStateDate(instance.expires_at)}</p>
              <p><strong>Reminder Timing:</strong> ${formatLivingStateDue(instance.expires_at)}</p>
            </div>
          `
          : ""
      }

      ${
        instance.tending_enabled && instance.tending_due_at
          ? `
            <div class="altar-info-card-section">
              <p><strong>Next Tending Reminder:</strong> ${formatLivingStateDue(instance.tending_due_at)}</p>
              <p><strong>Reminder Date:</strong> ${formatLivingStateDate(instance.tending_due_at)}</p>
            </div>
          `
          : ""
      }

      ${
        instance.remaining_amount !== null && instance.remaining_amount !== undefined
          ? `
            <div class="altar-info-card-section">
              <p><strong>Remaining:</strong> ${instance.remaining_amount} ${instance.amount_unit || ""}</p>
            </div>
          `
          : ""
      }

      ${
        instance.remaining_burn_seconds !== null && instance.remaining_burn_seconds !== undefined
          ? `
            <div class="altar-info-card-section">
              <p><strong>Burn Time Remaining:</strong> ${Math.round(instance.remaining_burn_seconds / 60)} minutes</p>
            </div>
          `
          : ""
      }

      <div class="altar-info-card-section altar-info-card-actions">
        <button type="button" class="living-state-practice-button" data-living-state-practice>
          ✨ Begin Today's Practice
        </button>
      </div>

      ${renderLivingStateRecentActivity(events)}
    </div>
  `;
}

async function showLivingStatePanel(object) {
  if (!altarLivingStatePanel || !object) return;

  const livingStateContent = altarLivingStatePanel.querySelector("[data-living-state-content]");
  if (!livingStateContent) return;

  const instanceId = object.dataset.instanceId || "";

  if (!instanceId) {
    altarLivingStatePanel.classList.remove("is-visible");
    altarLivingStatePanel.classList.add("is-minimized");
    return;
  }

  livingStateContent.innerHTML = `<p>Loading living state...</p>`;

  if (!altarLivingStateMinimized) {
    altarLivingStatePanel.classList.add("is-visible");
    altarLivingStatePanel.classList.remove("is-minimized");
  }

  const instance =
    typeof getObjectInstance === "function"
      ? await getObjectInstance(instanceId)
      : null;

  const events =
    typeof getObjectInstanceEvents === "function"
      ? await getObjectInstanceEvents(instanceId)
      : [];

  if (selectedObject !== object) return;

  livingStateContent.innerHTML = renderLivingStateMarkup(instance, events);
}

function hideLivingStatePanel() {
  if (!altarLivingStatePanel) return;

  const livingStateContent = altarLivingStatePanel.querySelector("[data-living-state-content]");
  if (livingStateContent) {
    livingStateContent.innerHTML = `<p>Select an object with a living state.</p>`;
  }

  altarLivingStatePanel.classList.remove("is-visible");
  altarLivingStatePanel.classList.add("is-minimized");
}

function showAltarInfoCard(object) {
  if (!altarInfoCard || !object) return;

  altarInfoCard.innerHTML = buildObjectInfoMarkup(object, "compact");

  altarInfoCard.hidden = false;
  altarInfoCard.classList.add("is-visible");

  showAltarCompanionPanel(object);
  showLivingStatePanel(object);
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
  hideLivingStatePanel();
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
  const companionToggleButton = event.target.closest("[data-companion-toggle], [data-companion-minimize]");
  const livingStateToggleButton = event.target.closest("[data-living-state-minimize]");

  if (!companionToggleButton && !livingStateToggleButton) return;

  if (companionToggleButton && altarCompanionPanel) {
    altarCompanionMinimized = !altarCompanionMinimized;

    altarCompanionPanel.classList.toggle("is-minimized", altarCompanionMinimized);
    document.body.classList.toggle("altar-companion-minimized", altarCompanionMinimized);

    if (altarLivingStatePanel) {
      altarLivingStateMinimized = altarCompanionMinimized;
      altarLivingStatePanel.classList.toggle("is-minimized", altarLivingStateMinimized);
      document.body.classList.toggle("altar-living-state-minimized", altarLivingStateMinimized);
    }

    document.querySelectorAll("[data-companion-toggle], [data-companion-minimize]").forEach((button) => {
      button.textContent = altarCompanionMinimized ? "☰" : "−";
      button.setAttribute(
        "aria-label",
        altarCompanionMinimized ? "Open panels" : "Minimize panels"
      );
    });

    if (selectedObject && !altarCompanionMinimized) {
      showAltarCompanionPanel(selectedObject);
      showLivingStatePanel(selectedObject);
    }

    showAltarToast(altarCompanionMinimized ? "Panels minimized" : "Panels opened");
  }

  if (livingStateToggleButton && altarLivingStatePanel) {
    altarLivingStateMinimized = !altarLivingStateMinimized;

    altarLivingStatePanel.classList.toggle("is-minimized", altarLivingStateMinimized);
    document.body.classList.toggle("altar-living-state-minimized", altarLivingStateMinimized);

    showAltarToast(altarLivingStateMinimized ? "Living State minimized" : "Living State opened");
  }

  requestAnimationFrame(() => {
    repositionAllObjectsFromPercent();
    resizeLightingCanvas();
    renderLighting();
  });
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