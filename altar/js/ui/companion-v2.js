/* =========================================================
   COMPANION PANEL V3
   Unified summary, knowledge, history, relationships, actions
   ========================================================= */

(function initializeCompanionV3() {
  if (typeof altarCompanionPanel === "undefined" || !altarCompanionPanel) return;

  const originalShowLivingStatePanel =
    typeof showLivingStatePanel === "function" ? showLivingStatePanel : null;

  const companionHeader = altarCompanionPanel.querySelector(".altar-companion-header");
  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");

  let currentCompanionObject = null;
  let currentLivingMarkup = "";

  function escapeCompanionHtml(value = "") {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSectionStateKey(title) {
    return `saltAndSovereigntyCompanionV3:${String(title || "section").toLowerCase()}`;
  }

  function getSavedSectionState(title, defaultOpen = false) {
    const saved = localStorage.getItem(getSectionStateKey(title));
    return saved === null ? defaultOpen : saved === "true";
  }

  function saveSectionState(title, isOpen) {
    localStorage.setItem(getSectionStateKey(title), String(isOpen));
  }

  function setCompanionHeader(title, typeLabel = "", secondaryLabel = "") {
    if (!companionHeader) return;

    const heading = companionHeader.querySelector("h2");
    if (heading) heading.textContent = title || "Companion";

    let tags = companionHeader.querySelector("[data-companion-header-tags]");

    if (!tags) {
      tags = document.createElement("div");
      tags.className = "companion-v3-header-tags";
      tags.setAttribute("data-companion-header-tags", "");
      companionHeader.querySelector("div")?.appendChild(tags);
    }

    tags.innerHTML = [typeLabel, secondaryLabel]
      .filter(Boolean)
      .map((label) => `<span>${escapeCompanionHtml(label)}</span>`)
      .join("");

    tags.hidden = !tags.innerHTML;
  }

  function getSectionTitle(section) {
    const heading = section.querySelector(":scope > h4");
    if (heading?.textContent.trim()) return heading.textContent.trim();

    const firstParagraph = section.querySelector(":scope > p:first-child");
    const strong = firstParagraph?.querySelector("strong");
    const text = strong?.textContent.trim().replace(/:$/, "");

    if (text === "Connected To") return "Relationships";
    if (text === "Living History" || text === "Recent Activity") return "History";
    return text || "Details";
  }

  function removeRedundantSectionHeading(section, title) {
    const heading = section.querySelector(":scope > h4");
    if (heading) heading.remove();

    const firstParagraph = section.querySelector(":scope > p:first-child");
    const strong = firstParagraph?.querySelector("strong");

    if (!firstParagraph || !strong) return;

    const paragraphText = firstParagraph.textContent.trim().replace(/:$/, "");
    const strongText = strong.textContent.trim().replace(/:$/, "");

    if (paragraphText === strongText || paragraphText === title) {
      firstParagraph.remove();
    }
  }

  function createDetailsMarkup(title, html, defaultOpen = false, extraClass = "") {
    if (!html || !String(html).trim()) return "";

    return `
      <details
        class="companion-v3-section ${extraClass}"
        data-companion-v3-section="${escapeCompanionHtml(title)}"
        ${getSavedSectionState(title, defaultOpen) ? "open" : ""}>
        <summary>${escapeCompanionHtml(title)}</summary>
        <div class="companion-v3-section-body">
          ${html}
        </div>
      </details>
    `;
  }

  function formatIngredient(ingredient = {}) {
    const name =
      ingredient.libraryName ||
      ingredient.label ||
      ingredient.name ||
      "Ingredient";

    const amount = String(ingredient.amount || "").trim();
    return amount ? `${name}: ${amount}` : name;
  }

  function buildObjectQuickSummary(object) {
    if (!object) return "";

    const settings =
      typeof getCompanionDisplaySettings === "function"
        ? getCompanionDisplaySettings()
        : {};

    const groups = [];

    const apothecaryDetails =
      typeof getApothecaryDetailsForObject === "function"
        ? getApothecaryDetailsForObject(object)
        : null;

    if (apothecaryDetails) {
      if (apothecaryDetails.intention && settings.companion_my_intentions !== false) {
        groups.push(`
          <div class="companion-v3-glance-group">
            <h3>Intention</h3>
            <p>${escapeCompanionHtml(apothecaryDetails.intention)}</p>
          </div>
        `);
      }

      if (
        Array.isArray(apothecaryDetails.ingredients) &&
        apothecaryDetails.ingredients.length &&
        settings.companion_my_ingredients !== false
      ) {
        groups.push(`
          <div class="companion-v3-glance-group">
            <h3>Contains</h3>
            <ul>
              ${apothecaryDetails.ingredients
                .map((ingredient) => `<li>${escapeCompanionHtml(formatIngredient(ingredient))}</li>`)
                .join("")}
            </ul>
          </div>
        `);
      }
    }

    const dressings = typeof getDressings === "function" ? getDressings(object) : [];

    if (dressings.length && settings.companion_my_dressings !== false) {
      groups.push(`
        <div class="companion-v3-glance-group">
          <h3>Dressed With</h3>
          <ul>
            ${dressings
              .map((dressing) => {
                const label =
                  typeof formatDressingName === "function"
                    ? formatDressingName(dressing)
                    : dressing.herb || dressing.label || dressing.type || "Dressing";
                return `<li>${escapeCompanionHtml(label)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `);
    }

    const activeGroup =
      object.dataset.groupId && typeof altarGroups !== "undefined"
        ? altarGroups.find((group) => group.id === object.dataset.groupId)
        : null;

    if (activeGroup && settings.companion_my_groups !== false) {
      const groupItems =
        typeof getGroupObjects === "function"
          ? getGroupObjects(activeGroup.id).map((item) => item.dataset.label || "Item")
          : [];

      groups.push(`
        <div class="companion-v3-glance-group">
          <h3>Ritual Group</h3>
          <p>${escapeCompanionHtml(activeGroup.name || "Group")}</p>
          ${groupItems.length ? `<p>${groupItems.map(escapeCompanionHtml).join(", ")}</p>` : ""}
        </div>
      `);
    }

    return groups.join("");
  }

  function parseLivingStateMarkup(markup = "") {
    if (!markup) return { summary: "", history: "", actions: "" };

    const template = document.createElement("template");
    template.innerHTML = markup;

    const root = template.content.querySelector(".altar-info-card-inner") || template.content;
    root.querySelector(":scope > h3")?.remove();
    root.querySelector(":scope > .altar-info-card-type")?.remove();

    const summaryParts = [];
    const historyParts = [];
    const actionParts = [];

    Array.from(root.querySelectorAll(":scope > .altar-info-card-section")).forEach((section) => {
      const title = getSectionTitle(section);

      if (section.classList.contains("altar-info-card-actions")) {
        actionParts.push(section.innerHTML);
        return;
      }

      if (title === "History") {
        removeRedundantSectionHeading(section, title);
        historyParts.push(section.innerHTML);
        return;
      }

      summaryParts.push(section.innerHTML);
    });

    return {
      summary: summaryParts.join(""),
      history: historyParts.join(""),
      actions: actionParts.join("")
    };
  }

  function buildKnowledgeSections(entity) {
    if (!entity || typeof renderCompanionLibraryEntity !== "function") return "";

    const settings =
      typeof getCompanionDisplaySettings === "function"
        ? getCompanionDisplaySettings()
        : {};

    const template = document.createElement("template");
    template.innerHTML = renderCompanionLibraryEntity(entity, settings);

    const root = template.content.querySelector(".altar-info-card-inner");
    if (!root) return "";

    const knowledgeSections = [];

    Array.from(root.querySelectorAll(":scope > .altar-info-card-section")).forEach((section) => {
      const title = getSectionTitle(section);

      if (!["My Practice", "Traditional", "Community"].includes(title)) return;

      removeRedundantSectionHeading(section, title);
      knowledgeSections.push(createDetailsMarkup(title, section.innerHTML, title === "My Practice"));
    });

    return knowledgeSections.join("");
  }

  function buildRelationshipsSection(entity) {
    if (!entity?.id || typeof renderConnectedEntityList !== "function") return "";

    const template = document.createElement("template");
    template.innerHTML = renderConnectedEntityList(entity.id);

    const section = template.content.querySelector(".altar-info-card-section");
    if (!section) {
      return createDetailsMarkup(
        "Relationships",
        `<p class="altar-info-empty">No relationships recorded yet.</p>`,
        false
      );
    }

    removeRedundantSectionHeading(section, "Relationships");
    return createDetailsMarkup("Relationships", section.innerHTML, false);
  }

  function buildHistorySection(entity, livingHistoryMarkup = "") {
    const timeline = entity?.id
      ? `<div data-library-activity-timeline="${escapeCompanionHtml(entity.id)}">
           ${livingHistoryMarkup || `<p class="altar-info-empty">Loading history...</p>`}
         </div>`
      : livingHistoryMarkup;

    if (!timeline) return "";
    return createDetailsMarkup("History", timeline, false);
  }

  function buildActionButtons(object, entity, livingActionsMarkup = "") {
    const actions = [];

    if (entity?.id) {
      actions.push(`
        <button
          type="button"
          class="altar-companion-edit-button"
          data-library-edit-section="myPractice"
          data-library-entity-id="${escapeCompanionHtml(entity.id)}">
          Edit My Practice Entry
        </button>
      `);

      actions.push(`
        <button type="button" data-manage-library-relationships="${escapeCompanionHtml(entity.id)}">
          Manage Relationships
        </button>
      `);

      actions.push(`
        <button type="button" data-open-living-history="${escapeCompanionHtml(entity.id)}">
          View Full History
        </button>
      `);
    }

    const apothecaryDetails =
      typeof getApothecaryDetailsForObject === "function"
        ? getApothecaryDetailsForObject(object)
        : null;

    if (apothecaryDetails?.itemId) {
      actions.push(`
        <button type="button" data-apothecary-edit="${escapeCompanionHtml(apothecaryDetails.itemId)}">
          Edit Selected Item
        </button>
      `);
    }

    if (object?.dataset.instanceId && livingActionsMarkup) {
      const template = document.createElement("template");
      template.innerHTML = livingActionsMarkup;
      const practiceButton = template.content.querySelector("[data-living-state-practice]");
      if (practiceButton) actions.push(practiceButton.outerHTML);
    }

    if (!actions.length) return "";

    return `
      <footer class="companion-v3-actions">
        ${actions.join("")}
      </footer>
    `;
  }

  function bindSectionStateListeners() {
    companionContent
      ?.querySelectorAll("details[data-companion-v3-section]")
      .forEach((details) => {
        details.addEventListener("toggle", () => {
          saveSectionState(details.dataset.companionV3Section, details.open);
        });
      });
  }

  function renderCompanion(object, livingMarkup = "") {
    if (!companionContent || !object) return;

    currentCompanionObject = object;
    currentLivingMarkup = livingMarkup || "";

    const label = object.dataset.label || "Altar Object";
    const icon = typeof getObjectIcon === "function" ? getObjectIcon(object) : "✦";
    const typeLabel =
      typeof getObjectTypeLabel === "function"
        ? getObjectTypeLabel(object)
        : object.dataset.type || "altar object";

    const secondaryLabel = object.dataset.form && object.dataset.form !== "standard"
      ? object.dataset.form
      : "";

    setCompanionHeader(`${icon} ${label}`, typeLabel, secondaryLabel);

    const entity =
      typeof getLibraryEntityForObject === "function"
        ? getLibraryEntityForObject(object)
        : null;

    const living = parseLivingStateMarkup(livingMarkup);
    const quickSummary = buildObjectQuickSummary(object);

    companionContent.innerHTML = `
      <div class="companion-v3-page">
        ${
          living.summary || quickSummary
            ? `
              <section class="companion-v3-glance" aria-label="At a glance">
                ${
                  living.summary
                    ? `<div class="companion-v3-living-summary">${living.summary}</div>`
                    : ""
                }
                ${quickSummary}
              </section>
            `
            : ""
        }

        <div class="companion-v3-knowledge">
          ${buildKnowledgeSections(entity)}
          ${buildRelationshipsSection(entity)}
          ${buildHistorySection(entity, living.history)}
        </div>

        ${buildActionButtons(object, entity, living.actions)}
      </div>
    `;

    bindSectionStateListeners();

    if (entity?.id && typeof hydrateCompanionLibraryExtras === "function") {
      hydrateCompanionLibraryExtras(entity.id).then(() => {
        const timelineTarget = companionContent.querySelector(
          `[data-library-activity-timeline="${CSS.escape(entity.id)}"]`
        );

        if (timelineTarget) {
          const nestedSection = timelineTarget.querySelector(".altar-info-card-section");
          if (nestedSection) {
            removeRedundantSectionHeading(nestedSection, "History");
            timelineTarget.innerHTML = nestedSection.innerHTML;
          }
        }
      });
    }

    altarCompanionPanel.classList.add("is-visible");
    altarCompanionPanel.classList.remove("is-minimized");
  }

  window.showAltarCompanionPanel = function showAltarCompanionPanelV3(object) {
    renderCompanion(object, object === currentCompanionObject ? currentLivingMarkup : "");
  };

  window.hideAltarCompanionPanel = function hideAltarCompanionPanelV3() {
    currentCompanionObject = null;
    currentLivingMarkup = "";

    setCompanionHeader("Companion", "", "");

    if (companionContent) {
      companionContent.innerHTML = `
        <div class="companion-v3-empty-state">
          <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
          <p>Select an object to see what is known, what it contains, and what it needs.</p>
        </div>
      `;
    }
  };

  if (originalShowLivingStatePanel) {
    window.showLivingStatePanel = async function showLivingStatePanelV3(object) {
      await originalShowLivingStatePanel(object);

      if (selectedObject !== object) return;

      const livingContent =
        typeof altarLivingStatePanel !== "undefined" && altarLivingStatePanel
          ? altarLivingStatePanel.querySelector("[data-living-state-content]")
          : null;

      renderCompanion(object, livingContent?.innerHTML || "");
    };
  }

  window.addEventListener("saltSettingsChanged", () => {
    if (!selectedObject) return;

    renderCompanion(selectedObject, currentLivingMarkup);

    if (typeof showLivingStatePanel === "function") {
      showLivingStatePanel(selectedObject);
    }
  });

  function syncCompanionHeight() {
    if (typeof altarWorkspacePanel === "undefined" || !altarWorkspacePanel) return;

    if (window.innerWidth <= 900) {
      altarWorkspacePanel.style.removeProperty("height");
      return;
    }

    const stageWrap = document.querySelector(".altar-stage-wrap");
    const actionBar = document.querySelector(".altar-action-bar");
    if (!stageWrap) return;

    const top = stageWrap.getBoundingClientRect().top;
    const bottom = actionBar
      ? actionBar.getBoundingClientRect().bottom
      : stageWrap.getBoundingClientRect().bottom;

    const height = Math.round(bottom - top);
    if (height > 0) altarWorkspacePanel.style.height = `${height}px`;
  }

  const resizeObserver = new ResizeObserver(syncCompanionHeight);
  const stageWrap = document.querySelector(".altar-stage-wrap");
  const actionBar = document.querySelector(".altar-action-bar");

  if (stageWrap) resizeObserver.observe(stageWrap);
  if (actionBar) resizeObserver.observe(actionBar);

  window.addEventListener("resize", syncCompanionHeight);
  window.requestAnimationFrame(syncCompanionHeight);

  if (typeof altarLivingStatePanel !== "undefined" && altarLivingStatePanel) {
    altarLivingStatePanel.hidden = true;
    altarLivingStatePanel.setAttribute("aria-hidden", "true");
  }

  window.hideAltarCompanionPanel();
})();
