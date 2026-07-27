/* =========================================================
   8. SELECTION, INFO CARD, AND COMPANION PANEL
   ========================================================= */


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

      ${renderConnectedEntityList(entity.id, { allowedRelations: ["contains"] })}
      <div data-library-activity-timeline="${entity.id}"></div>

    </div>
  `;
}

function formatLibraryRelationLabel(relation = "") {
  return String(relation || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReadableRelationLabel(connection, currentEntityId) {
  const isOutgoing = connection.from === currentEntityId;
  const relation = connection.relation;

  const outgoingLabels = {
    contains: "Contains",
    pairs_with: "Pairs With",
    substitutes: "Substitutes",
    substitute_for: "Substitute For",
    used_in: "Used In",
    associated_with: "Associated With",
    offered_to: "Offered To",
    ruled_by: "Ruled By",
    related_to: "Related To"
  };

  const incomingLabels = {
    contains: "Used In",
    ingredient_in: "Used In",
    pairs_with: "Pairs With",
    substitutes: "Substituted By",
    substitute_for: "Substitute For",
    used_in: "Contains",
    associated_with: "Associated With",
    offered_to: "Receives Offering From",
    ruled_by: "Rules",
    related_to: "Related To"
  };

  return isOutgoing
    ? outgoingLabels[relation] || formatLibraryRelationLabel(relation)
    : incomingLabels[relation] || formatLibraryRelationLabel(relation);
}

function renderConnectedEntityList(entityId, options = {}) {
  if (!entityId || typeof Library === "undefined") return "";

  const allowedRelations = options.allowedRelations || null;

  let connections =
    typeof Library.getConnections === "function"
      ? Library.getConnections(entityId)
      : [];

  if (Array.isArray(allowedRelations)) {
    connections = connections.filter((connection) => {
      return allowedRelations.includes(connection.relation);
    });
  }

  if (!connections.length) {
    return "";
  }

  const seen = new Set();

  const rows = connections
    .map((connection) => {
      const isOutgoing = connection.from === entityId;
      const otherId = isOutgoing ? connection.to : connection.from;
      const otherEntity = Library.getEntity(otherId);

      if (!otherEntity) return "";

      const label = getReadableRelationLabel(connection, entityId);
      const uniqueKey = `${connection.relation}|${label}|${otherId}`;

      if (seen.has(uniqueKey)) return "";
      seen.add(uniqueKey);

      return `
        <p>
          <strong>${label}:</strong>
          <button
            type="button"
            class="living-library-inline-link"
            data-open-library-entity="${otherEntity.id}">
            ${otherEntity.name || "Untitled"}
          </button>
          <span class="altar-info-muted">(${otherEntity.type || "entry"})</span>
        </p>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!rows) return "";

  return `
    <div class="altar-info-card-section">
      <p><strong>Connected To</strong></p>
      ${rows}
    </div>
  `;
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

function renderLivingStateEventIcon(eventType = "") {
  const icons = {
    created: "✦",
    tended: "🌿",
    charged: "🌙",
    ritual: "🕯️",
    journal: "📖",
    fed: "🌿",
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

function getLivingStateDisplaySettings() {
  const settings =
    typeof getLocalMySettings === "function"
      ? getLocalMySettings()
      : {};

  return {
    showStatus: settings.living_state_show_status !== false,
    showCreated: settings.living_state_show_created !== false,
    showSource: settings.living_state_show_source !== false,
    showLastTended: settings.living_state_show_last_tended !== false,
    showExpiration: settings.living_state_show_expiration !== false,
    showFutureTending: settings.living_state_show_future_tending !== false,
    showRemaining: settings.living_state_show_remaining !== false,
    showRecentActivity: settings.living_state_show_recent_activity !== false
  };
}

function formatLivingStateDue(value) {
  if (!value) return "";

  const dueDate = new Date(value);
  const now = new Date();

  if (Number.isNaN(dueDate.getTime())) return "";

  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
  }

  if (diffDays === 0) return "Due today";
  return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
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

        ${latestEvent.event_notes ? `<p>${latestEvent.event_notes}</p>` : ""}
      </div>
    </div>
  `;
}

function renderLivingStateMarkup(instance, events = []) {
  if (!instance) {
    return `
      <div class="altar-info-card-section living-state-section">
        <h4>Living State</h4>
        <p>No living state has been created for this object yet.</p>
      </div>
    `;
  }

  const displaySettings = getLivingStateDisplaySettings();

  return `
    <div class="living-state-section">
      <div class="altar-info-card-section">
        <h4>Living State</h4>
        <p><strong>${instance.name || "Current Manifestation"}</strong></p>
        <p class="altar-info-card-type">${instance.subtype || instance.object_type || "Living State"}</p>

        ${displaySettings.showStatus ? `<p><strong>Status:</strong> ${instance.status || "active"}</p>` : ""}
        ${displaySettings.showCreated && instance.started_at ? `<p><strong>Created:</strong> ${formatLivingStateDate(instance.started_at)}</p>` : ""}
        ${displaySettings.showSource && instance.source ? `<p><strong>Source:</strong> ${instance.source}</p>` : ""}
        ${displaySettings.showLastTended && instance.metadata?.last_tended_at ? `<p><strong>Last Tended:</strong> ${formatLivingStateDate(instance.metadata.last_tended_at)}</p>` : ""}
      </div>

      ${
        displaySettings.showExpiration && instance.expiration_enabled && instance.expires_at
          ? `
            <div class="altar-info-card-section">
              <p><strong>Expiration Reminder:</strong> ${formatLivingStateDate(instance.expires_at)}</p>
              <p><strong>Reminder Timing:</strong> ${formatLivingStateDue(instance.expires_at)}</p>
            </div>
          `
          : ""
      }

      ${
        displaySettings.showFutureTending && instance.tending_enabled && instance.tending_due_at
          ? `
            <div class="altar-info-card-section">
              <p><strong>Future Tending:</strong> ${formatLivingStateDue(instance.tending_due_at)}</p>
              <p><strong>Reminder Date:</strong> ${formatLivingStateDate(instance.tending_due_at)}</p>
            </div>
          `
          : ""
      }

      ${
        displaySettings.showRemaining &&
        instance.remaining_amount !== null &&
        instance.remaining_amount !== undefined
          ? `
            <div class="altar-info-card-section">
              <p><strong>Remaining:</strong> ${instance.remaining_amount} ${instance.amount_unit || ""}</p>
            </div>
          `
          : ""
      }

      ${
        displaySettings.showRemaining &&
        instance.remaining_burn_seconds !== null &&
        instance.remaining_burn_seconds !== undefined
          ? `
            <div class="altar-info-card-section">
              <p><strong>Burn Time Remaining:</strong> ${Math.round(instance.remaining_burn_seconds / 60)} minutes</p>
            </div>
          `
          : ""
      }

      ${displaySettings.showRecentActivity ? renderLivingStateRecentActivity(events) : ""}
    </div>
  `;
}

function renderEntityActivityTimeline(events = []) {
  if (!events.length) {
    return `
      <div class="altar-info-card-section living-state-history">
        <p><strong>Living History</strong></p>
        <p class="altar-info-empty">No activity recorded yet.</p>
      </div>
    `;
  }

  return `
    <div class="altar-info-card-section living-state-history">
      <p><strong>Living History</strong></p>

      ${events
        .slice(0, 12)
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

async function hydrateCompanionLibraryExtras(entityId) {

  if (!entityId) return;

  const timelineTarget = document.querySelector(`[data-library-activity-timeline="${entityId}"]`);

  if (timelineTarget) {

    timelineTarget.innerHTML = `

      <div class="altar-info-card-section living-state-history">

        <p><strong>Living History</strong></p>

        <p>Loading activity...</p>

      </div>

    `;

    const events =

      typeof getObjectInstanceEventsByEntity === "function"

        ? await getObjectInstanceEventsByEntity(entityId)

        : [];

    timelineTarget.innerHTML = renderEntityActivityTimeline(events);

  }

}

function showLibraryEntityInCompanion(entityId) {
  if (!altarCompanionPanel || !entityId || typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");

  if (!entity || !companionContent) return;

  companionContent.innerHTML = renderCompanionLibraryEntity(
    entity,
    getCompanionDisplaySettings()
  );

  hydrateCompanionLibraryExtras(entity.id);

  if (!document.body.classList.contains("altar-companion-minimized")) {
    altarCompanionPanel.classList.add("is-visible");
    altarCompanionPanel.classList.remove("is-minimized");
  }
}

function openLivingHistoryModal(entityId) {
  if (!entityId || typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  closeLivingHistoryModal();

  const modal = document.createElement("div");
  modal.className = "living-history-modal";
  modal.setAttribute("data-living-history-modal", "");
  modal.dataset.entityId = entityId;

  modal.innerHTML = `
    <div class="living-history-card" role="dialog" aria-modal="true">
      <button type="button" class="altar-cabinet-close" data-close-living-history aria-label="Close">
        ×
      </button>

      <p class="eyebrow">Living Library</p>
      <h2>${entity.name || "Living History"}</h2>
      <p class="altar-info-card-type">${entity.type || "entry"}</p>

      <div data-living-history-content>
        <p>Loading history...</p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("altar-modal-open");

  hydrateLivingHistoryModal(entityId);
}

function getRelationshipTypeOptions(selectedRelation = "") {
  const relations = [
    ["contains", "Contains"],
    ["used_in", "Used In"],
    ["pairs_with", "Pairs With"],
    ["substitutes", "Substitutes"],
    ["substitute_for", "Substitute For"],
    ["associated_with", "Associated With"],
    ["offered_to", "Offered To"],
    ["ruled_by", "Ruled By"],
    ["related_to", "Related To"]
  ];

  return relations
    .map(([value, label]) => `
      <option value="${value}" ${value === selectedRelation ? "selected" : ""}>
        ${label}
      </option>
    `)
    .join("");
}

function getLibraryEntityOptions(selectedEntityId = "", excludeEntityId = "") {
  if (typeof Library === "undefined") return "";

  const entities =
    typeof Library.getAllEntitiesSorted === "function"
      ? Library.getAllEntitiesSorted()
      : [];

  return entities
    .filter((entity) => entity.id !== excludeEntityId)
    .map((entity) => `
      <option value="${entity.id}" ${entity.id === selectedEntityId ? "selected" : ""}>
        ${entity.name || "Untitled"} (${entity.type || "entry"})
      </option>
    `)
    .join("");
}

function openRelationshipManagerModal(entityId) {
  if (!entityId || typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  closeRelationshipManagerModal();

  const connections =
    typeof Library.getConnections === "function"
      ? Library.getConnections(entityId)
      : [];

  const modal = document.createElement("div");
  modal.className = "living-history-modal";
  modal.setAttribute("data-relationship-manager-modal", "");
  modal.dataset.entityId = entityId;

  modal.innerHTML = `
    <div class="living-history-card" role="dialog" aria-modal="true">
      <button type="button" class="altar-cabinet-close" data-close-relationship-manager aria-label="Close">
        ×
      </button>

      <p class="eyebrow">Living Library</p>
      <h2>Relationships for ${entity.name || "this entry"}</h2>
      <p class="altar-info-card-type">${entity.type || "entry"}</p>

      <div class="altar-info-card-section">
        <p><strong>Add Relationship</strong></p>

        <form data-add-library-relationship>
          <label>
            Relationship
            <select name="relation">
              ${getRelationshipTypeOptions()}
            </select>
          </label>

          <label>
            Connected Entry
            <select name="target_entity_id" required>
              <option value="">Choose an entry</option>
              ${getLibraryEntityOptions("", entityId)}
            </select>
          </label>

          <button type="submit" class="button button--primary">
            Add Relationship
          </button>
        </form>
      </div>

      <div class="altar-info-card-section">
        <p><strong>Existing Relationships</strong></p>

        ${
          connections.length
            ? connections
                .map((connection) => {
                  const otherId = connection.from === entityId ? connection.to : connection.from;
                  const otherEntity = Library.getEntity(otherId);
                  if (!otherEntity) return "";

                  return `
                    <div class="relationship-manager-row" data-relationship-row="${connection.id}">
                      <form data-update-library-relationship="${connection.id}">
                        <label>
                          Relationship
                          <select name="relation">
                            ${getRelationshipTypeOptions(connection.relation)}
                          </select>
                        </label>

                        <label>
                          Connected Entry
                          <select name="target_entity_id">
                            ${getLibraryEntityOptions(otherId, entityId)}
                          </select>
                        </label>

                        <div class="relationship-manager-actions">
                          <button type="submit">Save</button>
                          <button type="button" data-delete-library-relationship="${connection.id}">
                            Delete
                          </button>
                        </div>
                      </form>
                    </div>
                  `;
                })
                .join("")
            : `<p class="altar-info-empty">No relationships yet.</p>`
        }
      </div>

      <div class="altar-info-card-section">
        <p><strong>Merge Duplicate Entry</strong></p>
        <p class="altar-info-empty">
          Use this only when two entries are truly the same thing.
        </p>

        <form data-merge-library-entity>
          <label>
            Merge this entry into
            <select name="destination_entity_id" required>
              <option value="">Choose destination entry</option>
              ${getLibraryEntityOptions("", entityId)}
            </select>
          </label>

          <button type="submit">
            Merge Into Selected Entry
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("altar-modal-open");
}

function closeRelationshipManagerModal() {
  const modal = document.querySelector("[data-relationship-manager-modal]");
  if (!modal) return;

  modal.remove();
  document.body.classList.remove("altar-modal-open");
}

function refreshRelationshipManagerModal(entityId) {
  closeRelationshipManagerModal();
  openRelationshipManagerModal(entityId);
}

function addLibraryRelationshipFromForm(form) {
  if (!form || typeof Library === "undefined") return;

  const modal = form.closest("[data-relationship-manager-modal]");
  const entityId = modal?.dataset.entityId || "";
  const formData = new FormData(form);

  const relation = String(formData.get("relation") || "").trim();
  const targetEntityId = String(formData.get("target_entity_id") || "").trim();

  if (!entityId || !relation || !targetEntityId) {
    showAltarToast("Choose a relationship and connected entry first");
    return;
  }

  const alreadyExists = Library.getConnections(entityId).some((connection) => {
    const otherId = connection.from === entityId ? connection.to : connection.from;
    return connection.relation === relation && otherId === targetEntityId;
  });

  if (alreadyExists) {
    showAltarToast("That relationship already exists");
    return;
  }

  Library.connect(entityId, relation, targetEntityId);

  showLibraryEntityInCompanion(entityId);
  refreshRelationshipManagerModal(entityId);
  showAltarToast("Relationship added");
}

function updateLibraryRelationshipFromForm(form) {
  if (!form || typeof Library === "undefined") return;

  const modal = form.closest("[data-relationship-manager-modal]");
  const entityId = modal?.dataset.entityId || "";
  const connectionId = form.dataset.updateLibraryRelationship || "";
  const formData = new FormData(form);

  const relation = String(formData.get("relation") || "");
  const targetEntityId = String(formData.get("target_entity_id") || "");

  const connection = Library.getConnections(entityId).find((link) => link.id === connectionId);
  if (!connection || !relation || !targetEntityId) return;

  const changes =
    connection.from === entityId
      ? { relation, to: targetEntityId }
      : { relation, from: targetEntityId };

  if (typeof Library.updateConnection === "function") {
    Library.updateConnection(connectionId, changes);
  }

  refreshRelationshipManagerModal(entityId);
  showLibraryEntityInCompanion(entityId);
}

function deleteLibraryRelationship(connectionId) {
  if (!connectionId || typeof Library === "undefined") return;

  const modal = document.querySelector("[data-relationship-manager-modal]");
  const entityId = modal?.dataset.entityId || "";

  if (typeof Library.removeConnection === "function") {
    Library.removeConnection(connectionId);
  }

  refreshRelationshipManagerModal(entityId);
  showLibraryEntityInCompanion(entityId);
}

function mergeLibraryEntityFromForm(form) {
  if (!form || typeof Library === "undefined") return;

  const modal = form.closest("[data-relationship-manager-modal]");
  const sourceId = modal?.dataset.entityId || "";
  const formData = new FormData(form);
  const destinationId = String(formData.get("destination_entity_id") || "");

  if (!sourceId || !destinationId || sourceId === destinationId) return;

  const source = Library.getEntity(sourceId);
  const destination = Library.getEntity(destinationId);

  const confirmed = window.confirm(
    `Merge "${source?.name || "this entry"}" into "${destination?.name || "the selected entry"}"? This cannot be undone.`
  );

  if (!confirmed) return;

  if (typeof Library.mergeDuplicateEntities === "function") {
    Library.mergeDuplicateEntities(sourceId, destinationId);
  }

  closeRelationshipManagerModal();
  showLibraryEntityInCompanion(destinationId);
}

function closeLivingHistoryModal() {
  const modal = document.querySelector("[data-living-history-modal]");
  if (!modal) return;

  modal.remove();
  document.body.classList.remove("altar-modal-open");
}

async function hydrateLivingHistoryModal(entityId) {
  const content = document.querySelector("[data-living-history-content]");
  if (!content) return;

  const events =
    typeof getObjectInstanceEventsByEntity === "function"
      ? await getObjectInstanceEventsByEntity(entityId)
      : [];

  content.innerHTML = renderEntityActivityTimeline(events);
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

      ${
        mode === "panel" && entity?.id
          ? renderConnectedEntityList(entity.id, { allowedRelations: ["contains"] })
          : ""
      }

      ${groupMarkup}
      ${apothecaryMarkup}
      ${dressingMarkup}
    </div>
  `;
}

async function showAltarCompanionPanel(object) {
  if (!altarCompanionPanel || !object) return;

  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");
  if (!companionContent) return;

  const baseMarkup = buildObjectInfoMarkup(object, "panel");
  const instanceId = object.dataset.instanceId || "";

  companionContent.innerHTML = `${baseMarkup}${
    instanceId
      ? `<div class="altar-info-card-section living-state-loading"><p>Loading living state...</p></div>`
      : ""
  }`;

  const entity = getLibraryEntityForObject(object);

  if (entity?.id && typeof hydrateCompanionLibraryExtras === "function") {
    hydrateCompanionLibraryExtras(entity.id);
  }

  if (instanceId) {
    const [instance, events] = await Promise.all([
      typeof getObjectInstance === "function"
        ? getObjectInstance(instanceId)
        : Promise.resolve(null),
      typeof getObjectInstanceEvents === "function"
        ? getObjectInstanceEvents(instanceId)
        : Promise.resolve([])
    ]);

    if (selectedObject !== object) return;

    companionContent.querySelector(".living-state-loading")?.remove();
    companionContent.insertAdjacentHTML(
      "beforeend",
      renderLivingStateMarkup(instance, events)
    );
  }

  if (!document.body.classList.contains("altar-companion-minimized")) {
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
  if (typeof renderSelectedObjectActions === "function") renderSelectedObjectActions(selectedObject);
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
  if (typeof renderSelectedObjectActions === "function") renderSelectedObjectActions(null);
  hideAltarInfoCard();
  updateSelectedGroupVisuals(null);
}

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
