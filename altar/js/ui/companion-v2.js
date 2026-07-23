/* =========================================================
   COMPANION PANEL V2
   One full-height, single-scroll field journal for the altar
   ========================================================= */

(function initializeCompanionV2() {
  if (typeof altarCompanionPanel === "undefined" || !altarCompanionPanel) return;

  const originalShowLivingStatePanel =
    typeof showLivingStatePanel === "function" ? showLivingStatePanel : null;

  const originalShowLibraryEntityInCompanion =
    typeof showLibraryEntityInCompanion === "function"
      ? showLibraryEntityInCompanion
      : null;

  const companionHeader = altarCompanionPanel.querySelector(".altar-companion-header");
  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");

  function getCompanionSectionStateKey(title) {
    return `saltAndSovereigntyCompanionV2:${String(title || "section").toLowerCase()}`;
  }

  function getSavedSectionState(title, defaultOpen = true) {
    const saved = localStorage.getItem(getCompanionSectionStateKey(title));
    return saved === null ? defaultOpen : saved === "true";
  }

  function saveSectionState(title, isOpen) {
    localStorage.setItem(getCompanionSectionStateKey(title), String(isOpen));
  }

  function getSectionTitle(section) {
    const heading = section.querySelector(":scope > h4");
    if (heading?.textContent.trim()) return heading.textContent.trim();

    const firstParagraph = section.querySelector(":scope > p:first-child");
    const strong = firstParagraph?.querySelector("strong");
    const text = strong?.textContent.trim().replace(/:$/, "");

    if (text === "Connected To") return "Related Objects";
    if (text === "Type") return "Apothecary Details";
    if (text) return text;

    return "Details";
  }

  function makeSectionCollapsible(section, defaultOpen = true) {
    if (!section || section.closest("details.companion-v2-section")) return;
    if (section.classList.contains("altar-info-card-actions")) return;

    const title = getSectionTitle(section);
    const details = document.createElement("details");
    details.className = "companion-v2-section";
    details.open = getSavedSectionState(title, defaultOpen);

    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);

    const heading = section.querySelector(":scope > h4");
    if (heading) heading.remove();

    const firstParagraph = section.querySelector(":scope > p:first-child");
    const firstStrong = firstParagraph?.querySelector("strong");

    if (
      firstParagraph &&
      firstStrong &&
      firstParagraph.textContent.trim().replace(/:$/, "") === firstStrong.textContent.trim().replace(/:$/, "")
    ) {
      firstParagraph.remove();
    }

    while (section.firstChild) {
      details.appendChild(section.firstChild);
    }

    details.addEventListener("toggle", () => {
      saveSectionState(title, details.open);
    });

    section.replaceWith(details);
  }

  function upgradeSections(root) {
    if (!root) return;

    Array.from(root.querySelectorAll(".altar-info-card-section")).forEach((section) => {
      const title = getSectionTitle(section);
      const defaultOpen = ["My Practice", "Living State", "Apothecary Details"].includes(title);
      makeSectionCollapsible(section, defaultOpen);
    });
  }

  function setCompanionHeader(title, typeLabel = "") {
    if (!companionHeader) return;

    const heading = companionHeader.querySelector("h2");
    if (heading) heading.textContent = title || "Companion";

    let type = companionHeader.querySelector("[data-companion-header-type]");

    if (!type) {
      type = document.createElement("p");
      type.className = "altar-info-card-type companion-v2-header-type";
      type.setAttribute("data-companion-header-type", "");
      companionHeader.querySelector("div")?.appendChild(type);
    }

    type.textContent = typeLabel || "";
    type.hidden = !typeLabel;
  }

  function mountLivingStatePanel() {
    if (!companionContent || typeof altarLivingStatePanel === "undefined" || !altarLivingStatePanel) {
      return;
    }

    if (altarLivingStatePanel.parentElement !== companionContent) {
      companionContent.appendChild(altarLivingStatePanel);
    }
  }

  function upgradeLivingStateSection() {
    if (typeof altarLivingStatePanel === "undefined" || !altarLivingStatePanel) return;

    const livingContent = altarLivingStatePanel.querySelector("[data-living-state-content]");
    if (!livingContent) return;

    upgradeSections(livingContent);
  }

  function renderSelectedObjectInCompanion(object) {
    if (!companionContent || !object) return;

    const label = object.dataset.label || "Altar Object";
    const icon = typeof getObjectIcon === "function" ? getObjectIcon(object) : "✦";
    const typeLabel =
      typeof getObjectTypeLabel === "function"
        ? getObjectTypeLabel(object)
        : object.dataset.type || "altar object";

    setCompanionHeader(`${icon} ${label}`, typeLabel);

    companionContent.innerHTML = buildObjectInfoMarkup(object, "panel");
    mountLivingStatePanel();

    const objectMarkup = companionContent.querySelector(".altar-info-card-inner");
    upgradeSections(objectMarkup);

    const entity =
      typeof getLibraryEntityForObject === "function"
        ? getLibraryEntityForObject(object)
        : null;

    if (entity?.id && typeof hydrateCompanionLibraryExtras === "function") {
      hydrateCompanionLibraryExtras(entity.id);
    }

    altarCompanionPanel.classList.add("is-visible");
    altarCompanionPanel.classList.remove("is-minimized");
  }

  window.showAltarCompanionPanel = function showAltarCompanionPanelV2(object) {
    renderSelectedObjectInCompanion(object);
  };

  window.hideAltarCompanionPanel = function hideAltarCompanionPanelV2() {
    if (!companionContent) return;

    setCompanionHeader("Companion", "");
    companionContent.innerHTML = `
      <div class="companion-v2-empty-state">
        <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
        <p>Select an object to open its field-journal page.</p>
      </div>
    `;

    mountLivingStatePanel();

    if (typeof altarLivingStatePanel !== "undefined" && altarLivingStatePanel) {
      altarLivingStatePanel.classList.remove("is-visible");
      altarLivingStatePanel.classList.add("is-minimized");
    }
  };

  if (originalShowLivingStatePanel) {
    window.showLivingStatePanel = async function showLivingStatePanelV2(object) {
      mountLivingStatePanel();
      await originalShowLivingStatePanel(object);
      mountLivingStatePanel();
      upgradeLivingStateSection();
    };
  }

  if (originalShowLibraryEntityInCompanion) {
    window.showLibraryEntityInCompanion = function showLibraryEntityInCompanionV2(entityId) {
      originalShowLibraryEntityInCompanion(entityId);

      if (typeof Library !== "undefined") {
        const entity = Library.getEntity(entityId);
        if (entity) {
          setCompanionHeader(entity.name || "Library Entry", entity.type || "entry");
        }
      }

      mountLivingStatePanel();
      upgradeSections(companionContent);
    };
  }

  function syncCompanionV2Height() {
    if (!altarWorkspacePanel) return;

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

    if (height > 0) {
      altarWorkspacePanel.style.height = `${height}px`;
    }
  }

  const resizeObserver = new ResizeObserver(syncCompanionV2Height);
  const stageWrap = document.querySelector(".altar-stage-wrap");
  const actionBar = document.querySelector(".altar-action-bar");

  if (stageWrap) resizeObserver.observe(stageWrap);
  if (actionBar) resizeObserver.observe(actionBar);

  window.addEventListener("resize", syncCompanionV2Height);
  window.requestAnimationFrame(syncCompanionV2Height);

  mountLivingStatePanel();
  window.hideAltarCompanionPanel();
})();
