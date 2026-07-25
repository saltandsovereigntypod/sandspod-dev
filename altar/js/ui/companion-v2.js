/* =========================================================
   COMPANION PANEL
   Single rendering authority for altar objects and library entries
   ========================================================= */

(function initializeCompanion() {
  if (typeof altarCompanionPanel === "undefined" || !altarCompanionPanel) return;

  const originalShowLivingStatePanel =
    typeof showLivingStatePanel === "function" ? showLivingStatePanel : null;

  const companionHeader = altarCompanionPanel.querySelector(".altar-companion-header");
  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");

  let currentCompanionObject = null;
  let currentCompanionEntity = null;
  let currentLivingMarkup = "";

  function escapeCompanionHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function humanizeCompanionKey(value = "") {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getSectionStateKey(title) {
    return `saltAndSovereigntyCompanion:${String(title || "section").toLowerCase()}`;
  }

  function getSavedSectionState(title, defaultOpen = false) {
    const saved = localStorage.getItem(getSectionStateKey(title));
    return saved === null ? defaultOpen : saved === "true";
  }

  function saveSectionState(title, isOpen) {
    localStorage.setItem(getSectionStateKey(title), String(isOpen));
  }

  function getSettings() {
    return typeof getCompanionDisplaySettings === "function"
      ? getCompanionDisplaySettings()
      : {};
  }

  function getEntityForObject(object) {
    return typeof getLibraryEntityForObject === "function"
      ? getLibraryEntityForObject(object)
      : null;
  }

  function getObjectIdentity(object, entity = null) {
    const rawType = String(
      object?.dataset.apothecaryType ||
      object?.dataset.type ||
      entity?.type ||
      "entry"
    ).toLowerCase();

    if (rawType.includes("spell jar") || rawType.includes("spell-jar")) return "spell-jar";
    if (rawType.includes("candle")) return "candle";
    if (rawType.includes("crystal")) return "crystal";
    if (rawType.includes("herb")) return "herb";
    if (rawType.includes("oil")) return "oil";
    if (rawType.includes("incense")) return "incense";
    if (rawType.includes("sachet")) return "sachet";
    if (rawType.includes("spray")) return "spray";
    if (rawType.includes("poppet")) return "poppet";
    if (rawType.includes("deity")) return "deity";
    return rawType.replace(/[^a-z0-9]+/g, "-") || "entry";
  }

  function getHeaderDescriptor(object, entity, identity) {
    const label = object?.dataset.label || entity?.name || "Companion";
    const icon = object && typeof getObjectIcon === "function" ? getObjectIcon(object) : "✦";
    const typeLabel = object && typeof getObjectTypeLabel === "function"
      ? getObjectTypeLabel(object)
      : entity?.type || "entry";
    const form = object?.dataset.form && object.dataset.form !== "standard"
      ? object.dataset.form
      : "";

    const base = { label, icon, typeLabel, secondaryLabel: form, identity, emphasis: [] };

    const hooks = {
      herb: renderHerbHeader,
      crystal: renderCrystalHeader,
      "spell-jar": renderSpellJarHeader,
      candle: renderCandleHeader,
      oil: renderOilHeader
    };

    return hooks[identity] ? hooks[identity](base, object, entity) : base;
  }

  function renderHerbHeader(header) {
    return { ...header, divider: "botanical", emphasis: ["Correspondences", "Planet", "Element", "Best Uses"] };
  }

  function renderCrystalHeader(header) {
    return { ...header, divider: "crystal", emphasis: ["Correspondences", "Charging", "Cleansing", "Uses"] };
  }

  function renderSpellJarHeader(header) {
    return { ...header, divider: "alchemy", emphasis: ["Ingredients", "Intention", "Creation Date", "Activation History"] };
  }

  function renderCandleHeader(header) {
    return { ...header, divider: "candle", emphasis: ["Color", "Burn State", "Remaining Burn", "Flame History"] };
  }

  function renderOilHeader(header) {
    return { ...header, divider: "alchemy", emphasis: ["Ingredients", "Recipe", "Shelf Life"] };
  }

  function renderHeader(object, entity) {
    if (!companionHeader) return;

    const identity = getObjectIdentity(object, entity);
    const descriptor = getHeaderDescriptor(object, entity, identity);
    const heading = companionHeader.querySelector("h2");

    altarCompanionPanel.dataset.companionIdentity = identity;
    altarCompanionPanel.dataset.companionDivider = descriptor.divider || "standard";

    if (heading) heading.textContent = `${descriptor.icon} ${descriptor.label}`.trim();

    let tags = companionHeader.querySelector("[data-companion-header-tags]");
    if (!tags) {
      tags = document.createElement("div");
      tags.className = "companion-v3-header-tags";
      tags.setAttribute("data-companion-header-tags", "");
      companionHeader.querySelector("div")?.appendChild(tags);
    }

    tags.innerHTML = [descriptor.typeLabel, descriptor.secondaryLabel]
      .filter(Boolean)
      .map((label) => `<span>${escapeCompanionHtml(label)}</span>`)
      .join("");
    tags.hidden = !tags.innerHTML;

    let emphasis = companionHeader.querySelector("[data-companion-emphasis]");
    if (!emphasis) {
      emphasis = document.createElement("div");
      emphasis.className = "companion-v3-emphasis";
      emphasis.setAttribute("data-companion-emphasis", "");
      companionHeader.querySelector("div")?.appendChild(emphasis);
    }

    emphasis.innerHTML = descriptor.emphasis
      .map((label) => `<span>${escapeCompanionHtml(label)}</span>`)
      .join("");
    emphasis.hidden = !descriptor.emphasis.length;
  }

  function createDetailsMarkup(title, html, defaultOpen = false, extraClass = "") {
    if (!html || !String(html).trim()) return "";

    return `
      <details
        class="companion-v3-section ${extraClass}"
        data-companion-v3-section="${escapeCompanionHtml(title)}"
        ${getSavedSectionState(title, defaultOpen) ? "open" : ""}>
        <summary>${escapeCompanionHtml(title)}</summary>
        <div class="companion-v3-section-body">${html}</div>
      </details>
    `;
  }

  function formatCompanionValue(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item && typeof item === "object") {
            const amount = item.amount ? `${item.amount} ` : "";
            return `${amount}${item.libraryName || item.label || item.name || "Item"}`.trim();
          }
          return item;
        })
        .filter(Boolean)
        .join(", ");
    }

    if (value && typeof value === "object") {
      return value.label || value.name || JSON.stringify(value);
    }

    return String(value ?? "");
  }

  function getFieldCategory(key = "") {
    const normalized = String(key).replaceAll("_", "").toLowerCase();
    const categories = {
      meaning: "meanings",
      meanings: "meanings",
      uses: "uses",
      bestuses: "uses",
      domains: "uses",
      purpose: "uses",
      element: "correspondences",
      planet: "correspondences",
      chakra: "correspondences",
      pantheon: "correspondences",
      correspondences: "correspondences",
      ingredients: "ingredients",
      recipe: "ingredients",
      intention: "intentions",
      intentions: "intentions",
      pairswith: "pairings",
      bestwith: "pairings",
      substitutions: "substitutions",
      traditionalwarnings: "warnings",
      warnings: "warnings",
      grimoirestatus: "grimoire",
      candledressings: "dressings",
      groups: "groups",
      notes: "notes",
      sources: "sources",
      source: "sources"
    };
    return categories[normalized] || "notes";
  }

  function shouldShowLayer(settings, layer) {
    return settings[`library_${layer}_enabled`] !== false;
  }

  function shouldShowField(settings, layer, key) {
    return settings[`library_${layer}_${getFieldCategory(key)}`] !== false;
  }

  function renderJournalFields(data = {}, layer, settings) {
    const entries = Object.entries(data).filter(([key, value]) => {
      if (key === "tags" || value === "" || value === null || value === undefined) return false;
      if (Array.isArray(value) && !value.length) return false;
      return shouldShowField(settings, layer, key);
    });

    if (!entries.length) return "";

    return `<div class="companion-v3-journal-fields">
      ${entries.map(([key, value]) => `
        <section class="companion-v3-journal-field" data-companion-field="${escapeCompanionHtml(key)}">
          <h4>${escapeCompanionHtml(humanizeCompanionKey(key))}</h4>
          <div>${escapeCompanionHtml(formatCompanionValue(value))}</div>
        </section>
      `).join("")}
    </div>`;
  }

  function renderTraditional(entity, settings) {
    if (!entity || !shouldShowLayer(settings, "traditional")) return "";
    const fields = renderJournalFields(entity.traditional || {}, "traditional", settings);
    return fields ? createDetailsMarkup("Traditional", fields, true, "companion-v3-traditional") : "";
  }

  function renderMyPractice(entity, settings) {
    if (!entity || !shouldShowLayer(settings, "myPractice")) return "";
    const fields = renderJournalFields(entity.myPractice || {}, "myPractice", settings);
    return fields ? createDetailsMarkup("My Practice", fields, true, "companion-v3-my-practice") : "";
  }

  function renderCommunity(entity, settings) {
    if (!entity || !shouldShowLayer(settings, "community")) return "";
    const fields = renderJournalFields(entity.community || {}, "community", settings);
    return fields ? createDetailsMarkup("Community", fields, false, "companion-v3-community") : "";
  }

  function parseLivingStateMarkup(markup = "") {
    if (!markup) return { status: "", history: "", actions: "" };

    const template = document.createElement("template");
    template.innerHTML = markup;
    const root = template.content.querySelector(".altar-info-card-inner") || template.content;

    root.querySelector(":scope > h3")?.remove();
    root.querySelector(":scope > .altar-info-card-type")?.remove();

    const statusParts = [];
    const historyParts = [];
    const actionParts = [];

    Array.from(root.querySelectorAll(":scope > .altar-info-card-section")).forEach((section) => {
      const headingText = section.querySelector(":scope > h4")?.textContent?.trim() ||
        section.querySelector(":scope > p:first-child strong")?.textContent?.trim().replace(/:$/, "") || "";

      if (section.classList.contains("altar-info-card-actions")) {
        actionParts.push(section.innerHTML);
      } else if (["Living History", "Recent Activity", "History"].includes(headingText)) {
        section.querySelector(":scope > p:first-child")?.remove();
        historyParts.push(section.innerHTML);
      } else {
        statusParts.push(section.innerHTML);
      }
    });

    return {
      status: statusParts.join(""),
      history: historyParts.join(""),
      actions: actionParts.join("")
    };
  }

  function formatIngredient(ingredient = {}) {
    const name = ingredient.libraryName || ingredient.label || ingredient.name || "Ingredient";
    const amount = String(ingredient.amount || "").trim();
    return amount ? `${name}: ${amount}` : name;
  }

  function renderObjectSummary(object, settings) {
    if (!object) return "";
    const groups = [];
    const apothecary = typeof getApothecaryDetailsForObject === "function"
      ? getApothecaryDetailsForObject(object)
      : null;

    if (apothecary?.intention && settings.companion_my_intentions !== false) {
      groups.push(`<div class="companion-v3-glance-group"><h3>Intention</h3><p>${escapeCompanionHtml(apothecary.intention)}</p></div>`);
    }

    if (Array.isArray(apothecary?.ingredients) && apothecary.ingredients.length && settings.companion_my_ingredients !== false) {
      groups.push(`
        <div class="companion-v3-glance-group">
          <h3>Ingredients</h3>
          <ul>${apothecary.ingredients.map((item) => `<li>${escapeCompanionHtml(formatIngredient(item))}</li>`).join("")}</ul>
        </div>
      `);
    }

    const dressings = typeof getDressings === "function" ? getDressings(object) : [];
    if (dressings.length && settings.companion_my_dressings !== false) {
      groups.push(`
        <div class="companion-v3-glance-group">
          <h3>Dressed With</h3>
          <ul>${dressings.map((dressing) => {
            const label = typeof formatDressingName === "function"
              ? formatDressingName(dressing)
              : dressing.herb || dressing.label || dressing.type || "Dressing";
            return `<li>${escapeCompanionHtml(label)}</li>`;
          }).join("")}</ul>
        </div>
      `);
    }

    const group = object.dataset.groupId && typeof altarGroups !== "undefined"
      ? altarGroups.find((item) => item.id === object.dataset.groupId)
      : null;

    if (group && settings.companion_my_groups !== false) {
      const members = typeof getGroupObjects === "function"
        ? getGroupObjects(group.id).map((item) => item.dataset.label || "Item")
        : [];
      groups.push(`
        <div class="companion-v3-glance-group">
          <h3>Ritual Group</h3>
          <p>${escapeCompanionHtml(group.name || "Group")}</p>
          ${members.length ? `<p>${members.map(escapeCompanionHtml).join(", ")}</p>` : ""}
        </div>
      `);
    }

    return groups.join("");
  }

  function renderStatus(object, living, settings) {
    const objectSummary = renderObjectSummary(object, settings);
    if (!living.status && !objectSummary) return "";

    return `
      <section class="companion-v3-glance" aria-label="Current status">
        ${living.status ? `<div class="companion-v3-living-summary">${living.status}</div>` : ""}
        ${objectSummary}
      </section>
    `;
  }

  function getRelationshipLabel(connection, entityId) {
    if (typeof getReadableRelationLabel === "function") {
      const label = getReadableRelationLabel(connection, entityId);
      return label === "Pairs With" ? "Pairs Well With" : label;
    }
    return humanizeCompanionKey(connection.relation || "Related To");
  }

  function renderRelationships(entity) {
    if (!entity?.id || typeof Library === "undefined" || typeof Library.getConnections !== "function") return "";

    const connections = Library.getConnections(entity.id) || [];
    const groups = new Map();
    const seen = new Set();

    connections.forEach((connection) => {
      const outgoing = connection.from === entity.id;
      const otherId = outgoing ? connection.to : connection.from;
      const otherEntity = Library.getEntity(otherId);
      if (!otherEntity) return;

      const label = getRelationshipLabel(connection, entity.id);
      const uniqueKey = `${label}|${otherId}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(otherEntity);
    });

    const body = groups.size
      ? Array.from(groups.entries()).map(([label, entities]) => `
          <section class="companion-v3-relationship-group">
            <h4>${escapeCompanionHtml(label)}</h4>
            <div class="companion-v3-relationship-chips">
              ${entities.map((related) => `
                <button
                  type="button"
                  class="living-library-inline-link companion-v3-relationship-chip"
                  data-open-library-entity="${escapeCompanionHtml(related.id)}">
                  ${escapeCompanionHtml(related.name || "Untitled")}
                </button>
              `).join("")}
            </div>
          </section>
        `).join("")
      : `<p class="altar-info-empty">No relationships recorded yet.</p>`;

    return createDetailsMarkup("Relationships", body, false, "companion-v3-relationships");
  }

  function renderHistory(entity, livingHistoryMarkup = "") {
    const timeline = entity?.id
      ? `<div data-library-activity-timeline="${escapeCompanionHtml(entity.id)}">${livingHistoryMarkup || `<p class="altar-info-empty">Loading history...</p>`}</div>`
      : livingHistoryMarkup;

    return timeline ? createDetailsMarkup("History", timeline, false, "companion-v3-history") : "";
  }

  function renderActions(object, entity, livingActionsMarkup = "") {
    const actions = [];

    if (entity?.id) {
      actions.push(`
        <button type="button" class="altar-companion-edit-button" data-library-edit-section="myPractice" data-library-entity-id="${escapeCompanionHtml(entity.id)}">
          Edit My Practice Entry
        </button>
      `);
      actions.push(`<button type="button" data-manage-library-relationships="${escapeCompanionHtml(entity.id)}">Manage Relationships</button>`);
      actions.push(`<button type="button" data-open-living-history="${escapeCompanionHtml(entity.id)}">View Full History</button>`);
    }

    const apothecary = object && typeof getApothecaryDetailsForObject === "function"
      ? getApothecaryDetailsForObject(object)
      : null;
    if (apothecary?.itemId) {
      actions.push(`<button type="button" data-apothecary-edit="${escapeCompanionHtml(apothecary.itemId)}">Edit Selected Item</button>`);
    }

    if (object?.dataset.instanceId && livingActionsMarkup) {
      const template = document.createElement("template");
      template.innerHTML = livingActionsMarkup;
      const practiceButton = template.content.querySelector("[data-living-state-practice]");
      if (practiceButton) actions.push(practiceButton.outerHTML);
    }

    return actions.length ? `<footer class="companion-v3-actions">${actions.join("")}</footer>` : "";
  }

  function renderKnowledge(entity, settings) {
    if (!entity) return "";

    const layerOrder = String(settings.library_layer_order || "myPractice,traditional,community")
      .split(",")
      .map((layer) => layer.trim())
      .filter(Boolean);

    const renderers = {
      myPractice: renderMyPractice,
      traditional: renderTraditional,
      community: renderCommunity
    };

    return layerOrder
      .map((layer) => renderers[layer]?.(entity, settings) || "")
      .join("");
  }

  function bindSectionStateListeners() {
    companionContent?.querySelectorAll("details[data-companion-v3-section]").forEach((details) => {
      details.addEventListener("toggle", () => {
        saveSectionState(details.dataset.companionV3Section, details.open);
      });
    });
  }

  function hydrateHistory(entityId) {
    if (!entityId || typeof hydrateCompanionLibraryExtras !== "function") return;

    hydrateCompanionLibraryExtras(entityId).then(() => {
      const target = companionContent?.querySelector(
        `[data-library-activity-timeline="${CSS.escape(entityId)}"]`
      );
      const nestedSection = target?.querySelector(".altar-info-card-section");
      if (!target || !nestedSection) return;

      nestedSection.querySelector(":scope > p:first-child")?.remove();
      target.innerHTML = nestedSection.innerHTML;
    });
  }

  function renderCompanionPage({ object = null, entity = null, livingMarkup = "" } = {}) {
    if (!companionContent || (!object && !entity)) return;

    const settings = getSettings();
    const living = parseLivingStateMarkup(livingMarkup);

    currentCompanionObject = object;
    currentCompanionEntity = entity;
    currentLivingMarkup = livingMarkup || "";

    renderHeader(object, entity);

    companionContent.innerHTML = `
      <div class="companion-v3-page">
        ${renderStatus(object, living, settings)}
        <div class="companion-v3-knowledge">
          ${renderKnowledge(entity, settings)}
          ${renderRelationships(entity)}
          ${renderHistory(entity, living.history)}
        </div>
        ${renderActions(object, entity, living.actions)}
      </div>
    `;

    bindSectionStateListeners();
    if (entity?.id) hydrateHistory(entity.id);

    altarCompanionPanel.classList.add("is-visible");
    altarCompanionPanel.classList.remove("is-minimized");
  }

  function renderSelectedObject(object, livingMarkup = "") {
    if (!object) return;
    renderCompanionPage({ object, entity: getEntityForObject(object), livingMarkup });
  }

  function renderLibraryEntity(entityId) {
    if (!entityId || typeof Library === "undefined") return;
    const entity = Library.getEntity(entityId);
    if (!entity) return;
    renderCompanionPage({ entity });
  }

  window.showAltarCompanionPanel = function showUnifiedAltarCompanionPanel(object) {
    const livingMarkup = object === currentCompanionObject ? currentLivingMarkup : "";
    renderSelectedObject(object, livingMarkup);
  };

  window.showLibraryEntityInCompanion = function showUnifiedLibraryEntityInCompanion(entityId) {
    renderLibraryEntity(entityId);
  };

  window.hideAltarCompanionPanel = function hideUnifiedAltarCompanionPanel() {
    currentCompanionObject = null;
    currentCompanionEntity = null;
    currentLivingMarkup = "";

    altarCompanionPanel.dataset.companionIdentity = "empty";
    altarCompanionPanel.dataset.companionDivider = "standard";

    const heading = companionHeader?.querySelector("h2");
    if (heading) heading.textContent = "Companion";
    companionHeader?.querySelector("[data-companion-header-tags]")?.replaceChildren();
    companionHeader?.querySelector("[data-companion-emphasis]")?.replaceChildren();

    if (companionContent) {
      companionContent.innerHTML = `
        <div class="companion-v3-empty-state">
          <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
          <p>Select an object to open its living page.</p>
        </div>
      `;
    }
  };

  if (originalShowLivingStatePanel) {
    window.showLivingStatePanel = async function provideLivingStateToCompanion(object) {
      await originalShowLivingStatePanel(object);
      if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

      const livingContent = typeof altarLivingStatePanel !== "undefined" && altarLivingStatePanel
        ? altarLivingStatePanel.querySelector("[data-living-state-content]")
        : null;

      renderSelectedObject(object, livingContent?.innerHTML || "");
    };
  }

  window.addEventListener("saltSettingsChanged", () => {
    if (currentCompanionObject) {
      renderSelectedObject(currentCompanionObject, currentLivingMarkup);
    } else if (currentCompanionEntity?.id) {
      renderLibraryEntity(currentCompanionEntity.id);
    }
  });

  if (typeof altarLivingStatePanel !== "undefined" && altarLivingStatePanel) {
    altarLivingStatePanel.hidden = true;
    altarLivingStatePanel.setAttribute("aria-hidden", "true");
    altarLivingStatePanel.remove();
  }

  window.hideAltarCompanionPanel();
})();
