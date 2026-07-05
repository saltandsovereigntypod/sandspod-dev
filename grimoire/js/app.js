/* =========================================================
   GRIMOIRE APP
   File: grimoire/js/app.js
   ========================================================= */

/* =========================================================
   AUTH STATE
   ========================================================= */

function updateAuthState() {
  const user = getUser();
  const isSignedIn = Boolean(user);

  if (grimoireAuthNotice) {
    grimoireAuthNotice.classList.toggle("is-signed-in", isSignedIn);
  }

  if (!isSignedIn) {
    renderSignedOutState();
    return;
  }

  initGrimoire();
}

function renderSignedOutState() {
  currentBook = null;
  sections = [];
  pages = [];
  currentPage = null;
  currentBlocks = [];
  pageLinks = [];
  activeSectionId = null;
  pageMode = "read";

  if (entryList) entryList.innerHTML = "";
  if (grimoireHeading) grimoireHeading.textContent = "Welcome";

  showEmptyState();
  updateEditButton();
  renderShelf();
}

/* =========================================================
   INITIALIZE GRIMOIRE
   ========================================================= */

async function syncTraditionalLibraryToGrimoireIfEnabled() {
  if (typeof TraditionalLibrary === "undefined") return;
  if (typeof Library === "undefined") return;
  if (typeof getMySettings !== "function") return;

  const settings = await getMySettings();

  if (!settings.sync_traditional_library_to_grimoire) return;

  Library.importTraditionalLibrary();
}

async function initGrimoire() {
  const user = requireUser();
  if (!user) return;

  try {
    setStatus("Opening your Book of Shadows...");

    await loadOrCreateBook(user);
    await loadSections();
    await loadPages();
    
    await syncTraditionalLibraryToGrimoireIfEnabled();
    
    const lastView = getLastGrimoireView();

    if (lastView?.type === "library" && lastView.id && typeof Library !== "undefined") {
      renderWelcomeState();
      renderShelf();
      await renderLivingLibraryShelves();
      await renderLibraryEntity(lastView.id);
    } else if (lastView?.type === "page" && pages.some((page) => page.id === lastView.id)) {
      await openPage(lastView.id, lastView.mode || "read");
      await renderLivingLibraryShelves();
    } else if (pages.length > 0) {
      await openPage(pages[0].id, "read");
      await renderLivingLibraryShelves();
    } else {
      renderWelcomeState();
      renderShelf();
      await renderLivingLibraryShelves();
    
      if (typeof Library !== "undefined") {
        const entities = Object.values(Library.exportLibrary().entities || {})
          .filter((entity) => entity.traditional || entity.myPractice)
          .sort((a, b) => a.name.localeCompare(b.name));
    
        if (entities.length) {
          await renderLibraryEntity(entities[0].id);
        }
      }
    }

    setStatus("");
  } catch (error) {
    console.error("Could not open grimoire:", error);
    setStatus(error.message || "The grimoire could not be opened.");
  }
}

/* =========================================================
   PAGE STATES
   ========================================================= */

function renderWelcomeState() {
  currentPage = null;
  currentBlocks = [];
  pageLinks = [];
  pageMode = "read";

  if (entryList) entryList.innerHTML = "";
  if (grimoireHeading) grimoireHeading.textContent = "Welcome";

  showEmptyState();
  updateEditButton();
}

async function openPage(pageId, mode = "read") {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return;

  activeLibraryEntityId = null;

  saveLastGrimoireView({
    type: "page",
    id: pageId,
    mode
  });

  currentPage = page;
  activeSectionId = page.section_id || null;
  pageMode = mode;
  searchTerm = "";

  if (entrySearch) entrySearch.value = "";
  if (grimoireHeading) grimoireHeading.textContent = page.title;

  hideEmptyState();
  updateEditButton();

  try {
    await loadBlocks(page);
    await loadPageLinks(page);
    renderShelf();
    renderPage();
  } catch (error) {
    console.error("Could not open page:", error);

    if (entryList) {
      entryList.innerHTML = `
        <section class="book-reader-page">
          <p class="book-placeholder">
            This page could not be opened: ${escapeHtml(error.message)}
          </p>
        </section>
      `;
    }
  }
}

/* =========================================================
   CREATE SECTIONS AND PAGES
   ========================================================= */

async function createSection() {
  const user = requireUser();
  if (!user || !currentBook) return;

  const title = window.prompt("Name this section:", "Herbs");
  if (!title || !title.trim()) return;

  const { data, error } = await db
    .from("grimoire_sections")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      title: title.trim(),
      sort_order: sections.length,
      is_collapsed: false
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  sections.push(data);
  activeSectionId = data.id;
  renderShelf();
  flashStatus("Section added.");
}

async function createPage(sectionId = activeSectionId) {
  const user = requireUser();
  if (!user || !currentBook) return;

  const templateKey = await openPageTemplateChooser();
  if (!templateKey) return;

  let chosenSectionId = sectionId || null;

  if (!chosenSectionId && sections.length > 0) {
    const makeLoosePage = window.confirm(
      "Create this as a loose page? Press Cancel to choose a section."
    );

    if (!makeLoosePage) {
      const sectionNames = sections
        .map((section, index) => `${index + 1}. ${section.title}`)
        .join("\n");

      const choice = window.prompt(`Choose a section number:\n\n${sectionNames}`, "1");
      const chosenIndex = Number(choice) - 1;

      if (sections[chosenIndex]) {
        chosenSectionId = sections[chosenIndex].id;
      }
    }
  }

  const title = window.prompt("Name this page:", "Untitled Page");
  if (!title || !title.trim()) return;

  const sectionPageCount = pages.filter(
    (page) => page.section_id === chosenSectionId
  ).length;

  const { data: page, error } = await db
    .from("grimoire_pages")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      section_id: chosenSectionId,
      title: title.trim(),
      icon: "",
      page_type: templateKey,
      sort_order: sectionPageCount
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  pages.push(page);
  currentPage = page;
  activeSectionId = chosenSectionId;

  const template = PAGE_TEMPLATES[templateKey] || PAGE_TEMPLATES.blank;
  await createTemplateBlocks(template.blocks);

  renderShelf();
  await openPage(page.id, "edit");
  flashStatus("Page added.");
}

async function createTemplateBlocks(blocks) {
  const user = requireUser();
  if (!user || !currentBook || !currentPage) return;

  const rows = blocks.map((block, index) => ({
    user_id: user.id,
    book_id: currentBook.id,
    page_id: currentPage.id,
    block_type: block.type,
    content: block.content || "",
    metadata: block.metadata || {},
    rich_content: block.rich_content || null,
    sort_order: index
  }));

  const { data, error } = await db
    .from("grimoire_blocks")
    .insert(rows)
    .select();

  if (error) throw error;

  currentBlocks = data || [];
}

/* =========================================================
   DELETE PAGE
   ========================================================= */

async function returnCurrentPageToAshes() {
  const user = requireUser();
  if (!user || !currentPage) return;

  const confirmed = window.confirm(
    `Return "${currentPage.title}" to ashes? This cannot be undone.`
  );

  if (!confirmed) return;

  const pageId = currentPage.id;

  const { error } = await db
    .from("grimoire_pages")
    .delete()
    .eq("id", pageId);

  if (error) {
    setStatus(error.message);
    return;
  }

  pages = pages.filter((page) => page.id !== pageId);
  currentPage = null;
  currentBlocks = [];
  pageLinks = [];

  renderShelf();

  if (pages.length > 0) {
    await openPage(pages[0].id, "read");
  } else {
    renderWelcomeState();
  }

  flashStatus("Page returned to ashes.");
}

/* =========================================================
   PAGE LINKS
   ========================================================= */

async function linkExistingPage() {
  if (!currentPage || pages.length < 2) {
    flashStatus("Create another page first.");
    return;
  }

  const target = await openPageChooser("Choose a page to link");
  if (!target) return;

  const user = requireUser();
  if (!user || !currentBook) return;

  const { data, error } = await db
    .from("grimoire_page_links")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      source_page_id: currentPage.id,
      target_page_id: target.id,
      link_label: target.title
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  pageLinks.push(data);
  flashStatus("Page linked.");
  renderEditor();
}

async function choosePageForBlock(blockId) {
  const target = await openPageChooser("Choose a linked page");
  if (!target) return;

  await saveBlockMetadata(blockId, "target_page_id", target.id);
  await saveBlockMetadata(blockId, "label", target.title);

  renderEditor();
}

/* =========================================================
   ALTAR IMPORT TO RITUAL PAGE
   ========================================================= */

function formatAltarImportItems(items = []) {
  const groupedItems = {};

  items.forEach((item) => {
    const type = item.type || "item";
    const label = ALTAR_IMPORT_TYPE_LABELS[type] || "Other Items";

    if (!groupedItems[label]) {
      groupedItems[label] = [];
    }

    groupedItems[label].push(item);
  });

  return Object.entries(groupedItems)
    .map(([groupLabel, groupItems]) => {
      const itemLines = groupItems
        .map((item) => {
          const parts = [];

          if (item.label) parts.push(item.label);
          if (item.color) parts.push(`Color: ${item.color}`);
          if (item.form) parts.push(`Form: ${item.form}`);

          return parts.join(" · ");
        })
        .join("\n");

      return {
        groupLabel,
        content: itemLines
      };
    })
    .filter((group) => group.content.trim());
}

async function createRitualPageFromAltarImport(ritual, purpose = "") {
  const user = requireUser();

  if (!user || !currentBook) {
    setStatus("Sign in to create a ritual page.");
    return;
  }

  const title = ritual.name || "Ritual Working";
  const groupedItems = formatAltarImportItems(ritual.items || []);

  const { data: page, error } = await db
    .from("grimoire_pages")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      section_id: activeSectionId || null,
      title,
      icon: "",
      page_type: "ritual",
      sort_order: pages.length
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  pages.push(page);
  currentPage = page;

  const ritualBlocks = [
    { type: "heading", content: "Date" },
    { type: "text", content: formatDate(new Date().toISOString()) },

    { type: "heading", content: "Purpose" },
    { type: "text", content: purpose || "" },

    { type: "heading", content: "Items from the Altar" }
  ];

  groupedItems.forEach((group) => {
    ritualBlocks.push({
      type: "heading",
      content: group.groupLabel
    });

    ritualBlocks.push({
      type: "ingredient_list",
      content: group.content
    });
  });

  ritualBlocks.push(
    { type: "heading", content: "Ritual Steps" },
    { type: "numbered_list", content: "" },
    { type: "heading", content: "Results" },
    { type: "text", content: "" },
    { type: "heading", content: "Reflection" },
    { type: "text", content: "" }
  );

  const rows = ritualBlocks.map((block, index) => ({
    user_id: user.id,
    book_id: currentBook.id,
    page_id: page.id,
    block_type: block.type,
    content: block.content || "",
    metadata: {},
    rich_content: null,
    sort_order: index
  }));

  const { data: blocks, error: blockError } = await db
    .from("grimoire_blocks")
    .insert(rows)
    .select();

  if (blockError) {
    setStatus(blockError.message);
    return;
  }

  currentBlocks = blocks || [];
  pageLinks = [];

  renderShelf();
  await openPage(page.id, "edit");

  flashStatus("Ritual page created.");
}

/* =========================================================
   TEMPLATES
   ========================================================= */

async function applyTemplateToCurrentPage() {
  const templateKey = await openPageTemplateChooser();
  if (!templateKey || !PAGE_TEMPLATES[templateKey] || !currentPage) return;

  const confirmed = window.confirm(
    "Add this template to the current page? It will not delete existing content."
  );

  if (!confirmed) return;

  const template = PAGE_TEMPLATES[templateKey];
  const offset = currentBlocks.length;

  const rows = template.blocks.map((block, index) => ({
    user_id: getUser().id,
    book_id: currentBook.id,
    page_id: currentPage.id,
    block_type: block.type,
    content: block.content || "",
    metadata: block.metadata || {},
    rich_content: block.rich_content || null,
    sort_order: offset + index
  }));

  const { data, error } = await db
    .from("grimoire_blocks")
    .insert(rows)
    .select();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = [...currentBlocks, ...(data || [])];
  renderEditor();
  flashStatus("Template added.");
}

/* =========================================================
   LIVING LIBRARY BROWSER
   Virtual grimoire view for Traditional Library entities
   ========================================================= */

let activeLibraryEntityId = null;

let libraryEditMode = false;

const LIBRARY_PAGE_LAYOUT_KEY = "saltAndSovereigntyLibraryPageLayouts";

function getLibraryPageLayouts() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_PAGE_LAYOUT_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLibraryPageLayouts(layouts) {
  localStorage.setItem(LIBRARY_PAGE_LAYOUT_KEY, JSON.stringify(layouts));
}

function getLibraryPageLayout(entityId) {
  const layouts = getLibraryPageLayouts();

  return layouts[entityId] || {
    sectionOrder: ["myPractice", "traditional", "community", "related"],
    hiddenFields: {},
    fieldOrder: {},
    customFields: []
  };
}

function saveLibraryPageLayout(entityId, layout) {
  const layouts = getLibraryPageLayouts();
  layouts[entityId] = layout;
  saveLibraryPageLayouts(layouts);
}

const GRIMOIRE_LAST_VIEW_KEY = "saltAndSovereigntyLastGrimoireView";

function saveLastGrimoireView(view) {
  localStorage.setItem(GRIMOIRE_LAST_VIEW_KEY, JSON.stringify(view));
}

function getLastGrimoireView() {
  try {
    return JSON.parse(localStorage.getItem(GRIMOIRE_LAST_VIEW_KEY)) || null;
  } catch {
    return null;
  }
}

const LIBRARY_SHELF_STATE_KEY = "saltAndSovereigntyLibraryShelfState";
let librarySearchTerm = "";

const MY_PRACTICE_TYPES = [
  "herb",
  "crystal",
  "candle",
  "deity",
  "tool",
  "vessel",
  "apothecary",
  "ritual",
  "spell",
  "note",
  "section"
];

function getLibraryShelfState() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_SHELF_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLibraryShelfState(key, isOpen) {
  const state = getLibraryShelfState();
  state[key] = Boolean(isOpen);
  localStorage.setItem(LIBRARY_SHELF_STATE_KEY, JSON.stringify(state));
}

function isLibraryShelfOpen(key) {
  const state = getLibraryShelfState();

  if (!(key in state)) {
    return key === "my-practice-root" || key === "traditional-root";
  }

  return Boolean(state[key]);
}

function getMyPracticeTypeLabel(type = "") {
  const labels = {
    herb: "Herbs",
    crystal: "Crystals",
    candle: "Candles",
    deity: "Deities",
    tool: "Tools",
    vessel: "Vessels",
    apothecary: "Apothecary",
    ritual: "Rituals",
    spell: "Spells",
    note: "Notes",
    section: "Sections"
  };

  return labels[type] || formatLibraryEntityName(type);
}

async function renderMyPracticeShelf() {
  if (!grimoireShelf) return;
  if (typeof Library === "undefined") return;

  const existing = grimoireShelf.querySelector("[data-my-practice-shelf]");
  if (existing) existing.remove();

  const search = librarySearchTerm.trim().toLowerCase();

  const wrapper = document.createElement("section");
  wrapper.className = "book-toc-section my-practice-shelf";
  wrapper.setAttribute("data-my-practice-shelf", "");

  wrapper.innerHTML = `
    <button class="book-section-title traditional-library-title" type="button" data-my-practice-toggle>
      <span>My Practice</span>
    </button>

    <div class="book-section-pages traditional-library-root" data-my-practice-list ${isLibraryShelfOpen("my-practice-root") ? "" : "hidden"}>
      <button class="button button--primary my-practice-new-entry-button" type="button" data-create-library-entry>
        New Entry
      </button>

      <label class="library-sidebar-search">
        <span class="sr-only">Search My Practice</span>
        <input
          type="search"
          placeholder="Search my practice..."
          value="${escapeHtml(librarySearchTerm)}"
          data-library-search
        />
      </label>

      ${MY_PRACTICE_TYPES
        .map((type) => {
          const entities = Library.getMyPracticeEntitiesByType(type)
            .filter((entity) => {
              if (!search) return true;
              return `${entity.name} ${entity.type}`.toLowerCase().includes(search);
            })
            .sort((a, b) => a.name.localeCompare(b.name));

          const groupKey = `my-practice-${type}`;
          const isOpen = isLibraryShelfOpen(groupKey);

          return `
            <div class="traditional-library-group" data-my-practice-group="${type}">
              <button class="traditional-library-group-title" type="button" data-my-practice-type-toggle="${type}">
                <span>${isOpen ? "▾" : "▸"}</span>
                ${getMyPracticeTypeLabel(type)}
              </button>

              <div class="traditional-library-entity-list" data-my-practice-type-list="${type}" ${isOpen ? "" : "hidden"}>
                ${
                  entities.length
                    ? entities
                        .map((entity) => `
                          <button
                            type="button"
                            class="book-page-link traditional-library-entity-link ${activeLibraryEntityId === entity.id ? "is-active" : ""}"
                            data-library-entity-id="${entity.id}">
                            ${formatLibraryEntityName(entity.name)}
                          </button>
                        `)
                        .join("")
                    : `<p class="book-section-empty">Nothing added yet.</p>`
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  grimoireShelf.prepend(wrapper);
}

async function renderLivingLibraryShelves() {
  await renderMyPracticeShelf();
  await renderTraditionalLibraryShelf();
}

function formatLibraryEntityName(name = "") {
  return String(name)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLibraryFieldName(name = "") {
  const labels = {
    PairsWith: "Pairs Well With",
    TraditionalWarnings: "Warnings",
    SacredSymbols: "Sacred Symbols",
    SacredAnimals: "Sacred Animals",
    SacredPlants: "Sacred Plants",
    CandleColors: "Candle Colors",
    TraditionallyMadeFrom: "Traditionally Made From",
    TraditionallyUsedFor: "Traditionally Used For",
    CommonMaterials: "Common Materials",
    BestFor: "Best For",
    BestWith: "Best With",
    UsedFor: "Used For"
  };

  return labels[name] || formatLibraryEntityName(name);
}

function getTraditionalTypeLabel(type = "") {
  const labels = {
    herb: "Herbs",
    crystal: "Crystals",
    candle: "Candles",
    deity: "Deities",
    tool: "Tools",
    vessel: "Vessels",
    apothecary: "Apothecary"
  };

  return labels[type] || formatLibraryEntityName(type);
}

function getLibraryEntityIntro(entity) {
  const traditional = entity.traditional || {};
  const uses = traditional.Uses || traditional.Domains || traditional.Purpose || "";

  if (!uses) {
    return `${formatLibraryEntityName(entity.name)} is part of the Traditional Library.`;
  }

  return `${formatLibraryEntityName(entity.name)} is traditionally associated with ${String(uses).toLowerCase()}.`;
}

function splitLibraryList(value) {
  if (Array.isArray(value)) return value;

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderLibraryChips(value) {
  const items = splitLibraryList(value);

  if (!items.length) return "";

  return `
    <div class="book-library-chips">
      ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function renderLibraryPlainValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => escapeHtml(item)).join(", ");
  }

  return String(value || "");
}

function renderLibraryField(key, value, layer = "", entityId = "") {
  if (!value || key === "tags") return "";

  const chipFields = [
    "Uses",
    "Domains",
    "PairsWith",
    "Substitutions",
    "BestFor",
    "BestWith",
    "Cleansing",
    "Offerings",
    "Herbs",
    "Crystals",
    "CandleColors",
    "SacredSymbols",
    "SacredAnimals",
    "SacredPlants",
    "tags"
  ];

  const valueText = String(value || "");
  const containsHtml = /<\/?[a-z][\s\S]*>/i.test(valueText);
  const useChips = chipFields.includes(key) && !containsHtml;

  return `
    <div class="book-library-field">
      ${
        `<h3>
            ${libraryEditMode && layer && entityId ? `
              <button class="library-field-move" type="button" data-move-library-field-up="${entityId}" data-layer="${layer}" data-field="${key}">↑</button>
              <button class="library-field-move" type="button" data-move-library-field-down="${entityId}" data-layer="${layer}" data-field="${key}">↓</button>
              <label class="library-field-hide">
                <input type="checkbox" data-toggle-library-field="${entityId}" data-layer="${layer}" data-field="${key}" checked />
              </label>
            ` : ""}
            ${formatLibraryFieldName(key)}
          </h3>`
      }
      ${
        useChips
          ? renderLibraryChips(value)
          : `<p>${renderLibraryPlainValue(value)}</p>`
      }
    </div>
  `;
}

function groupTraditionalFields(traditional = {}, layout = {}) {
  const usedKeys = new Set();

  const orderedKeys = [
    "Meaning",
    "Meanings",
    "Uses",
    "Domains",
    "Purpose",
    "Element",
    "Planet",
    "Chakra",
    "Pantheon",
    "PairsWith",
    "Substitutions",
    "BestWith",
    "Ingredients",
    "Intention",
    "Intentions",
    "SacredSymbols",
    "SacredAnimals",
    "SacredPlants",
    "Offerings",
    "TraditionallyMadeFrom",
    "TraditionallyUsedFor",
    "CommonMaterials",
    "Cleansing",
    "TraditionalWarnings",
    "Warnings",
    "Sources",
    "Source",
    "Notes"
  ];

  const hidden = layout.hiddenFields?.traditional || [];
  const order = layout.fieldOrder?.traditional?.length ? layout.fieldOrder.traditional : orderedKeys;

  const fields = order
    .filter((key) => traditional[key])
    .filter((key) => !hidden.includes(key))
    .map((key) => {
      usedKeys.add(key);
      return renderLibraryField(key, traditional[key], "traditional", activeLibraryEntityId);
    })
    .join("");

  const extraFields = Object.entries(traditional)
    .filter(([key]) => key !== "tags" && !usedKeys.has(key))
    .map(([key, value]) => renderLibraryField(key, value, "traditional", activeLibraryEntityId))
    .join("");

  return `
    <div class="book-library-fields">
      ${fields}
      ${extraFields}
    </div>
  `;
}

async function shouldShowTraditionalLibrary() {
  if (typeof getMySettings !== "function") return false;

  const settings = await getMySettings();

  return Boolean(settings.sync_traditional_library_to_grimoire);
}

async function renderTraditionalLibraryShelf() {
  if (!grimoireShelf) return;
  if (typeof Library === "undefined") return;
  if (typeof TraditionalLibrary === "undefined") return;
  if (typeof getMySettings !== "function") return;

  const showTraditional = await shouldShowTraditionalLibrary();

  const existing = grimoireShelf.querySelector("[data-traditional-library-shelf]");
  if (existing) existing.remove();

  if (!showTraditional) return;

  Library.importTraditionalLibrary();

  const search = librarySearchTerm.trim().toLowerCase();
  const types = ["herb", "crystal", "candle", "deity", "tool", "vessel"];

  const wrapper = document.createElement("section");
  wrapper.className = "book-toc-section traditional-library-shelf";
  wrapper.setAttribute("data-traditional-library-shelf", "");

  wrapper.innerHTML = `
    <button class="book-section-title traditional-library-title" type="button" data-traditional-library-toggle>
      <span>Traditional Information</span>
    </button>

    <div class="book-section-pages traditional-library-root" data-traditional-library-list ${isLibraryShelfOpen("traditional-root") ? "" : "hidden"}>
      <label class="library-sidebar-search">
        <span class="sr-only">Search Traditional Information</span>
        <input
          type="search"
          placeholder="Search traditional..."
          value="${escapeHtml(librarySearchTerm)}"
          data-library-search
        />
      </label>

      ${types
        .map((type) => {
          const entities = Library.getEntitiesByType(type)
            .filter((entity) => entity.traditional && Object.keys(entity.traditional).length)
            .filter((entity) => {
              if (!search) return true;
              return `${entity.name} ${entity.type} ${JSON.stringify(entity.traditional)}`.toLowerCase().includes(search);
            })
            .sort((a, b) => a.name.localeCompare(b.name));

          const groupKey = `traditional-${type}`;
          const isOpen = isLibraryShelfOpen(groupKey);

          if (!entities.length && search) return "";

          return `
            <div class="traditional-library-group" data-traditional-library-group="${type}">
              <button class="traditional-library-group-title" type="button" data-library-type-toggle="${type}">
                <span>${isOpen ? "▾" : "▸"}</span>
                ${getTraditionalTypeLabel(type)}
              </button>

              <div class="traditional-library-entity-list" data-library-type-list="${type}" ${isOpen ? "" : "hidden"}>
                ${
                  entities.length
                    ? entities
                        .map((entity) => `
                          <button
                            type="button"
                            class="book-page-link traditional-library-entity-link ${activeLibraryEntityId === entity.id ? "is-active" : ""}"
                            data-library-entity-id="${entity.id}">
                            ${formatLibraryEntityName(entity.name)}
                          </button>
                        `)
                        .join("")
                    : `<p class="book-section-empty">No entries found.</p>`
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  grimoireShelf.appendChild(wrapper);
}
function renderMyPracticeLayer(entity, layout = getLibraryPageLayout(entity.id)) {
  const myPractice = entity.myPractice || {};
  const entries = Object.entries(myPractice).filter(([, value]) => value);

  if (libraryEditMode) {
    let fields = [
      ["Meaning", "Meaning"],
      ["Uses", "Uses"],
      ["PairsWith", "Pairs With"],
      ["Substitutions", "Substitutions"],
      ["Notes", "Notes"],
      ...((layout.customFields || []).map((field) => [field.key, field.label]))
    ];

    const fieldOrder = layout.fieldOrder?.myPractice || [];

    if (fieldOrder.length) {
      fields = fields.sort(([a], [b]) => {
        const aIndex = fieldOrder.indexOf(a);
        const bIndex = fieldOrder.indexOf(b);

        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    }

    return `
      <div data-editing-my-practice="${entity.id}">
        <h2>My Practice</h2>

        <div class="book-library-edit-fields">
          ${fields
            .filter(([key]) => !(layout.hiddenFields?.myPractice || []).includes(key) || libraryEditMode)
            .map(([key, label]) => `
              <section class="book-library-edit-field">
                <h3>
                  <button class="library-field-move" type="button" data-move-library-field-up="${entity.id}" data-layer="myPractice" data-field="${key}">↑</button>
                  <button class="library-field-move" type="button" data-move-library-field-down="${entity.id}" data-layer="myPractice" data-field="${key}">↓</button>

                  <label class="library-field-hide">
                    <input
                      type="checkbox"
                      data-toggle-library-field="${entity.id}"
                      data-layer="myPractice"
                      data-field="${key}"
                      ${(layout.hiddenFields?.myPractice || []).includes(key) ? "" : "checked"}
                    />
                    Show
                  </label>

                  ${label}
                </h3>

                <div class="book-rich-toolbar" aria-label="Formatting tools">
                  <button type="button" data-rich-command="bold">B</button>
                  <button type="button" data-rich-command="italic"><em>I</em></button>
                  <button type="button" data-rich-command="underline"><u>U</u></button>
                  <button type="button" data-rich-command="insertUnorderedList">• List</button>
                  <button type="button" data-rich-command="insertOrderedList">1. List</button>
                  <button type="button" data-rich-command="formatBlock" data-rich-value="blockquote">Quote</button>
                </div>

                <div
                  class="book-rich-input book-library-rich-input"
                  contenteditable="true"
                  data-library-edit-field="${key}">
                  ${myPractice[key] || ""}
                </div>
              </section>
            `)
            .join("")}
        </div>

        <div class="book-library-custom-field-row">
          <button class="button button--small" type="button" data-add-library-custom-field="${entity.id}">
            Add Custom Field
          </button>
        </div>

        <div class="book-library-edit-actions">
          <button class="button button--primary button--small" type="button" data-save-library-practice="${entity.id}">
            Save My Practice
          </button>

          <button class="button button--small button--ghost" type="button" data-cancel-library-edit>
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div>

      ${
        entries.length
          ? `
            <div class="book-library-fields">
              ${entries
                .filter(([key]) => !(layout.hiddenFields?.myPractice || []).includes(key))
                .sort(([a], [b]) => {
                  const order = layout.fieldOrder?.myPractice || [];
                  return (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b));
                })
                .map(([key, value]) => renderLibraryField(key, value, "myPractice", entity.id))
                .join("")}
            </div>
          `
          : `
            <p class="book-placeholder">
              No personal practice notes have been added yet.
            </p>
          `
      }
    </div>
  `;
}

async function saveLibraryPracticeFromPage(entityId) {
  if (typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  const section = document.querySelector(`[data-editing-my-practice="${entityId}"]`);
  if (!section) return;

  const myPractice = {};

  section.querySelectorAll("[data-library-edit-field]").forEach((field) => {
    const key = field.dataset.libraryEditField;
    const value = field.innerHTML.trim();

    if (value) {
      myPractice[key] = value;
    }
  });

  Library.updateEntity(entityId, { myPractice });

  if (typeof Library.syncMyPracticeConnections === "function") {
    Library.syncMyPracticeConnections(entityId);
  }

  libraryEditMode = false;

  await renderLivingLibraryShelves();
  await renderLibraryEntity(entityId);

  flashStatus("My Practice saved.");
}

function renderCommunityLayer(entity) {
  const community = entity.community || {};
  const entries = Object.entries(community).filter(([, value]) => value);

  return `
    <div>

      ${
        entries.length
          ? `
            <div class="book-library-fields">
              ${entries
                .filter(([key]) => {
                  const layout = getLibraryPageLayout(entity.id);
                  return !(layout.hiddenFields?.community || []).includes(key);
                })
                .sort(([a], [b]) => {
                  const layout = getLibraryPageLayout(entity.id);
                  const order = layout.fieldOrder?.community || [];
                  return (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b));
                })
                .map(([key, value]) => renderLibraryField(key, value, "community", entity.id))
                .join("")}
            </div>
          `
          : `
            <p class="book-placeholder">
              No community information has been approved yet.
            </p>
          `
      }
    </div>
  `;
}

function renderRelatedEntriesLayer(entity) {
  if (typeof Library === "undefined") return "";

  const connections = Library.getConnections(entity.id) || [];
  const grouped = {};

  connections.forEach((connection) => {
    const relatedId = connection.from === entity.id ? connection.to : connection.from;
    const relatedEntity = Library.getEntity(relatedId);

    if (!relatedEntity) return;

    const relation = connection.relation || "related_to";

    if (!grouped[relation]) grouped[relation] = new Map();

    grouped[relation].set(relatedEntity.id, relatedEntity);
  });

  const relationLabels = {
    pairs_with: "Pairs With",
    substitutes: "Substitutes",
    substitute_for: "Substitute For",
    ingredient_in: "Ingredient In",
    contains: "Contains",
    used_in: "Used In",
    associated_with: "Associated With",
    offered_to: "Offered To",
    ruled_by: "Ruled By",
    related_to: "Related To"
  };

  const relationOrder = [
    "pairs_with",
    "substitutes",
    "substitute_for",
    "ingredient_in",
    "contains",
    "used_in",
    "associated_with",
    "offered_to",
    "ruled_by",
    "related_to"
  ];

  const hasConnections = Object.keys(grouped).length > 0;

  if (!hasConnections) return "";

  return `
   <div>

      ${relationOrder
        .filter((relation) => grouped[relation])
        .map((relation) => {
          const entities = Array.from(grouped[relation].values())
            .sort((a, b) => a.name.localeCompare(b.name));

          return `
            <div class="book-library-related-group">
              <h3>${relationLabels[relation] || formatLibraryFieldName(relation)}</h3>

              <div class="book-library-chips">
                ${entities
                  .map((relatedEntity) => `
                    <button
                      type="button"
                      class="book-library-chip-button"
                      data-library-entity-id="${relatedEntity.id}">
                      ${formatLibraryEntityName(relatedEntity.name)}
                    </button>
                  `)
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

let cachedLibraryPageSettings = null;

async function getLibraryPageSettings() {
  if (cachedLibraryPageSettings) return cachedLibraryPageSettings;

  if (typeof getMySettings !== "function") {
    cachedLibraryPageSettings = {};
    return cachedLibraryPageSettings;
  }

  cachedLibraryPageSettings = await getMySettings();
  return cachedLibraryPageSettings;
}

function libraryFieldCategory(key = "") {
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

function shouldShowLibraryField(settings, layer, key) {
  const category = libraryFieldCategory(key);
  return settings[`library_${layer}_${category}`] !== false;
}

function filterLibraryLayerData(data = {}, settings = {}, layer = "traditional") {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
      if (key === "tags") return true;
      if (!value) return false;
      return shouldShowLibraryField(settings, layer, key);
    })
  );
}

function renderSectionShell(layer, entity, content) {
  if (!content) return "";

  const labels = {
    myPractice: "My Practice",
    traditional: "Traditional Information",
    community: "Community",
    related: "Connected To"
  };

  const controls = libraryEditMode
    ? `
      <div class="library-section-controls">
        <button type="button" data-move-library-section-up="${entity.id}" data-section="${layer}">↑</button>
        <button type="button" data-move-library-section-down="${entity.id}" data-section="${layer}">↓</button>
      </div>
    `
    : "";

  return `
    <section class="book-library-layer book-library-layer--${layer}">
      <div class="library-section-heading-row">
        <h2>${labels[layer] || formatLibraryEntityName(layer)}</h2>
        ${controls}
      </div>

      ${content}
    </section>
  `;
}

function renderLibraryLayerByName(layer, entity, settings, layout = getLibraryPageLayout(entity.id)) {
  const sectionLabels = {
    myPractice: "My Practice",
    traditional: "Traditional Information",
    community: "Community",
    related: "Connected To"
  };
  if (settings[`library_${layer}_enabled`] === false) return "";

  if (layer === "myPractice") {
    const filtered = filterLibraryLayerData(entity.myPractice || {}, settings, "myPractice");
    return renderSectionShell(
      "myPractice",
      entity,
      renderMyPracticeLayer({ ...entity, myPractice: filtered }, layout)
    );
  }

  if (layer === "traditional") {
    const filtered = filterLibraryLayerData(entity.traditional || {}, settings, "traditional");

    return renderSectionShell(
      "traditional",
      entity,
      groupTraditionalFields(filtered, layout) || `<p class="book-placeholder">No traditional information is available yet.</p>`
    );
  }

  if (layer === "community") {
    const filtered = filterLibraryLayerData(entity.community || {}, settings, "community");
    return renderSectionShell(
      "community",
      entity,
      renderCommunityLayer({ ...entity, community: filtered })
    );
  }

  return "";
}

function renderLibraryLayers(entity, settings, layout = getLibraryPageLayout(entity.id)) {
  const defaultOrder = String(settings.library_layer_order || "myPractice,traditional,community")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const sectionOrder = layout.sectionOrder?.length
    ? layout.sectionOrder
    : [...defaultOrder, "related"];

  return sectionOrder
    .map((layer) => {
      if (layer === "related") {
        return renderSectionShell("related", entity, renderRelatedEntriesLayer(entity));
      }

      return renderLibraryLayerByName(layer, entity, settings, layout);
    })
    .join("");
}

function getLibrarySearchText(entity) {
  return [
    entity.name,
    entity.type,
    ...(entity.aliases || []),
    JSON.stringify(entity.traditional || {}),
    JSON.stringify(entity.myPractice || {}),
    JSON.stringify(entity.community || {})
  ].join(" ").toLowerCase();
}

function renderGlobalLibrarySearchResults(term) {
  const existing = document.querySelector("[data-global-library-search-results]");
  if (existing) existing.remove();

  if (!term || typeof Library === "undefined") return;

  const page = document.querySelector(".book-library-entity-page");
  if (!page) return;

  const results = Object.values(Library.exportLibrary().entities || {})
    .filter((entity) => getLibrarySearchText(entity).includes(term))
    .slice(0, 12);

  const box = document.createElement("div");
  box.className = "global-library-search-results";
  box.setAttribute("data-global-library-search-results", "");

  box.innerHTML = results.length
    ? results
        .map((entity) => `
          <button type="button" data-library-entity-id="${entity.id}">
            <span>${formatLibraryEntityName(entity.name)}</span>
            <small>${getMyPracticeTypeLabel(entity.type)}</small>
          </button>
        `)
        .join("")
    : `<p>No matching library entries found.</p>`;

  const toolbar = page.querySelector(".book-library-sticky-tools");
  toolbar?.insertAdjacentElement("afterend", box);
}

async function renderLibraryEntity(entityId) {
  if (!entryList || typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  activeLibraryEntityId = entityId;
  saveLastGrimoireView({
    type: "library",
    id: entityId
  });
  currentPage = null;
  currentBlocks = [];
  pageLinks = [];
  pageMode = "read";

  if (grimoireHeading) {
    grimoireHeading.textContent = formatLibraryEntityName(entity.name);
  }

  hideEmptyState();
  updateEditButton();

  const traditional = entity.traditional || {};
  const tags = Array.isArray(traditional.tags) ? traditional.tags : [];

  const settings = await getLibraryPageSettings();
  const layout = getLibraryPageLayout(entity.id);
  const renderedLayers = renderLibraryLayers(entity, settings, layout);

  entryList.innerHTML = `
    <section class="book-reader-page book-library-entity-page">
       <div class="book-library-sticky-tools">
          <div class="book-library-sticky-left">
            <button
              class="grimoire-menu-button"
              type="button"
              data-grimoire-menu-button
              aria-label="Open Table of Contents">
              ☰
            </button>
            <label class="book-library-sticky-search">
              <span class="sr-only">Search this page</span>
              <input type="search" placeholder="Search this page..." data-library-page-search />
            </label>

            ${
              Object.keys(entity.myPractice || {}).length
                ? `
                  <button class="button button--small" type="button" data-toggle-library-edit="${entity.id}">
                    ${libraryEditMode ? "Preview" : "Edit"}
                  </button>

                  <label class="button button--small button--ghost book-library-image-upload">
                    Upload Image
                    <input type="file" accept="image/png,image/jpeg,image/webp" data-upload-library-image="${entity.id}" hidden />
                  </label>

                  <button class="button button--small button--ghost" type="button" data-delete-library-entry="${entity.id}">
                    Del
                  </button>
                `
                : ""
            }
          </div>

          <label class="book-library-mundane-toggle">
            <input type="checkbox" data-mundane-toggle ${document.body.classList.contains("mundane-mode") ? "checked" : ""} />
            Mundane
          </label>
        </div>
      <header class="book-reader-header book-library-header">

        <h1>${formatLibraryEntityName(entity.name)}</h1>

        ${entity.image ? `
          <figure class="book-library-hero-image">
            <img src="${entity.image}" alt="${escapeHtml(entity.name)}" />
          </figure>
        ` : ""}

        <p class="book-library-intro">
          ${escapeHtml(getLibraryEntityIntro(entity))}
        </p>

        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>

      </header>

      <div class="book-reader-body book-library-body">
        ${renderedLayers}
      </div>
    </section>
  `;

  renderLivingLibraryShelves();
}

function openCreateLibraryEntryModal() {
  const modal = document.createElement("div");
  modal.className = "book-modal-backdrop";
  modal.setAttribute("data-library-entry-modal", "");

  modal.innerHTML = `
    <div class="book-modal" role="dialog" aria-modal="true" aria-label="Create new practice entry">
      <header>
        <h2>New Practice Entry</h2>
        <button type="button" data-close-library-entry-modal aria-label="Close">×</button>
      </header>

      <div class="book-modal-body">
        <form class="my-sanctuary-form" data-create-library-entry-form>
          <label>
            Entry Type
            <select name="type" required>
              <option value="herb">Herb</option>
              <option value="crystal">Crystal</option>
              <option value="candle">Candle</option>
              <option value="deity">Deity</option>
              <option value="tool">Tool</option>
              <option value="vessel">Vessel</option>
              <option value="apothecary">Apothecary</option>
              <option value="ritual">Ritual</option>
              <option value="spell">Spell</option>
              <option value="note">Note</option>
              <option value="section">Section</option>
            </select>
          </label>

          <label>
            Name
            <input type="text" name="name" placeholder="Rosemary, Dream Oil, Full Moon Ritual..." required />
          </label>

          <label>
            Meaning
            <textarea name="Meaning" rows="3"></textarea>
          </label>

          <label>
            Uses
            <textarea name="Uses" rows="3"></textarea>
          </label>

          <label>
            Pairs With
            <textarea name="PairsWith" rows="2"></textarea>
          </label>

          <label>
            Substitutions
            <textarea name="Substitutions" rows="2"></textarea>
          </label>

          <label>
            Notes
            <textarea name="Notes" rows="5"></textarea>
          </label>

          <button class="button button--primary" type="submit">
            Create Entry
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeCreateLibraryEntryModal() {
  const modal = document.querySelector("[data-library-entry-modal]");
  if (!modal) return;

  modal.remove();
}

function createLibraryEntryFromForm(form) {
  if (typeof Library === "undefined") return null;

  const formData = new FormData(form);
  const type = String(formData.get("type") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!type || !name) return null;

  const entity = Library.getOrCreateEntity({
    name,
    type
  });

  const myPractice = {
    ...(entity.myPractice || {}),
    Meaning: String(formData.get("Meaning") || "").trim(),
    Uses: String(formData.get("Uses") || "").trim(),
    PairsWith: String(formData.get("PairsWith") || "").trim(),
    Substitutions: String(formData.get("Substitutions") || "").trim(),
    Notes: String(formData.get("Notes") || "").trim()
  };

  Object.keys(myPractice).forEach((key) => {
    if (!myPractice[key]) delete myPractice[key];
  });

  Library.updateEntitySection(entity.id, "myPractice", myPractice);
  Library.syncMyPracticeConnections(entity.id);

  return Library.getEntity(entity.id);
}

function openEditLibraryEntryModal(entityId) {
  if (typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  const myPractice = entity.myPractice || {};

  const modal = document.createElement("div");
  modal.className = "book-modal-backdrop";
  modal.setAttribute("data-library-edit-modal", "");

  modal.innerHTML = `
    <div class="book-modal" role="dialog" aria-modal="true" aria-label="Edit practice entry">
      <header>
        <h2>Edit Entry</h2>
        <button type="button" data-close-library-edit-modal aria-label="Close">×</button>
      </header>

      <div class="book-modal-body">
        <form class="my-sanctuary-form" data-edit-library-entry-form data-library-entity-id="${entity.id}">
          <label>
            Entry Type
            <select name="type" required>
              ${MY_PRACTICE_TYPES
                .map((type) => `
                  <option value="${type}" ${entity.type === type ? "selected" : ""}>
                    ${getMyPracticeTypeLabel(type).replace(/s$/, "")}
                  </option>
                `)
                .join("")}
            </select>
          </label>

          <label>
            Name
            <input type="text" name="name" value="${escapeHtml(entity.name)}" required />
          </label>

          <label>
            Image
            <input type="file" name="image" accept="image/png,image/webp,image/jpeg" />
          </label>

          ${
            entity.image
              ? `<p class="book-section-empty">Current image is saved. Upload a new one to replace it.</p>`
              : ""
          }

          <label>
            Meaning
            <textarea name="Meaning" rows="3">${escapeHtml(myPractice.Meaning || "")}</textarea>
          </label>

          <label>
            Uses
            <textarea name="Uses" rows="3">${escapeHtml(myPractice.Uses || "")}</textarea>
          </label>

          <label>
            Pairs With
            <textarea name="PairsWith" rows="2">${escapeHtml(myPractice.PairsWith || "")}</textarea>
          </label>

          <label>
            Substitutions
            <textarea name="Substitutions" rows="2">${escapeHtml(myPractice.Substitutions || "")}</textarea>
          </label>

          <label>
            Notes
            <textarea name="Notes" rows="5">${escapeHtml(myPractice.Notes || "")}</textarea>
          </label>

          <button class="button button--primary" type="submit">
            Save Entry
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeEditLibraryEntryModal() {
  const modal = document.querySelector("[data-library-edit-modal]");
  if (!modal) return;

  modal.remove();
}

function readLibraryImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function updateLibraryEntryFromForm(form) {
  if (typeof Library === "undefined") return null;

  const entityId = form.dataset.libraryEntityId;
  const entity = Library.getEntity(entityId);

  if (!entity) return null;

  const formData = new FormData(form);
  const type = String(formData.get("type") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const imageFile = formData.get("image");

  if (!type || !name) return null;

  Library.updateEntity(entityId, { name });
  Library.updateEntityType(entityId, type);

  if (imageFile && imageFile.size) {
    const image = await readLibraryImageFile(imageFile);
    Library.updateEntityImage(entityId, image);
  }

  const myPractice = {
    Meaning: String(formData.get("Meaning") || "").trim(),
    Uses: String(formData.get("Uses") || "").trim(),
    PairsWith: String(formData.get("PairsWith") || "").trim(),
    Substitutions: String(formData.get("Substitutions") || "").trim(),
    Notes: String(formData.get("Notes") || "").trim()
  };

  Object.keys(myPractice).forEach((key) => {
    if (!myPractice[key]) delete myPractice[key];
  });

  Library.updateEntity(entityId, {
    myPractice
  });

  Library.syncMyPracticeConnections(entityId);

  return Library.getEntity(entityId);
}

async function deleteLibraryEntryFromMyPractice(entityId) {
  if (typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  const confirmed = window.confirm(
    `Delete your My Practice notes for "${formatLibraryEntityName(entity.name)}"? The traditional entry will remain if it exists.`
  );

  if (!confirmed) return;

  Library.updateEntity(entityId, {
    myPractice: {}
  });

  await renderLivingLibraryShelves();
  await renderLibraryEntity(entityId);

  flashStatus("Removed from My Practice.");
}

document.addEventListener("click", async (event) => {
  const libraryEntityButton = event.target.closest("[data-library-entity-id]");
  const createEntryButton = event.target.closest("[data-create-library-entry]");
  const closeEntryModalButton = event.target.closest("[data-close-library-entry-modal]");
  const myPracticeToggle = event.target.closest("[data-my-practice-toggle]");
  const myPracticeTypeToggle = event.target.closest("[data-my-practice-type-toggle]");
  const traditionalToggle = event.target.closest("[data-traditional-library-toggle]");
  const typeToggle = event.target.closest("[data-library-type-toggle]");
  const editEntryButton = event.target.closest("[data-edit-library-entry]");
  const deleteEntryButton = event.target.closest("[data-delete-library-entry]");
  const closeEditModalButton = event.target.closest("[data-close-library-edit-modal]");
  const toggleLibraryEditButton = event.target.closest("[data-toggle-library-edit]");
  const saveLibraryPracticeButton = event.target.closest("[data-save-library-practice]");
  const cancelLibraryEditButton = event.target.closest("[data-cancel-library-edit]");
  const richCommandButton = event.target.closest("[data-rich-command]");
  const addCustomFieldButton = event.target.closest("[data-add-library-custom-field]");
  const moveFieldUpButton = event.target.closest("[data-move-library-field-up]");
  const moveFieldDownButton = event.target.closest("[data-move-library-field-down]");
  const toggleFieldButton = event.target.closest("[data-toggle-library-field]");
  const moveSectionUpButton = event.target.closest("[data-move-library-section-up]");
  const moveSectionDownButton = event.target.closest("[data-move-library-section-down]");

  if (richCommandButton) {
    const command = richCommandButton.dataset.richCommand;
    const value = richCommandButton.dataset.richValue || null;

    document.execCommand(command, false, value);
    return;
  }

  if (moveSectionUpButton || moveSectionDownButton) {
    const button = moveSectionUpButton || moveSectionDownButton;
    const entityId = button.dataset.moveLibrarySectionUp || button.dataset.moveLibrarySectionDown;
    const section = button.dataset.section;
    const direction = moveSectionUpButton ? -1 : 1;

    const layout = getLibraryPageLayout(entityId);
    layout.sectionOrder ||= ["myPractice", "traditional", "community", "related"];

    const index = layout.sectionOrder.indexOf(section);
    const newIndex = index + direction;

    if (index >= 0 && newIndex >= 0 && newIndex < layout.sectionOrder.length) {
      const [moved] = layout.sectionOrder.splice(index, 1);
      layout.sectionOrder.splice(newIndex, 0, moved);
    }

    saveLibraryPageLayout(entityId, layout);
    await renderLibraryEntity(entityId);
    return;
  }
  
  if (addCustomFieldButton) {
    const entityId = addCustomFieldButton.dataset.addLibraryCustomField;
    const label = window.prompt("Name this custom field:", "Dream Notes");
    if (!label || !label.trim()) return;

    const layout = getLibraryPageLayout(entityId);
    const key = label.trim().replace(/\s+/g, "_");

    layout.customFields ||= [];
    layout.customFields.push({ key, label: label.trim() });

    saveLibraryPageLayout(entityId, layout);
    await renderLibraryEntity(entityId);
    return;
  }

  if (moveFieldUpButton || moveFieldDownButton) {
    const button = moveFieldUpButton || moveFieldDownButton;
    const entityId = button.dataset.moveLibraryFieldUp || button.dataset.moveLibraryFieldDown;
    const layer = button.dataset.layer;
    const field = button.dataset.field;
    const direction = moveFieldUpButton ? -1 : 1;

    const layout = getLibraryPageLayout(entityId);
    layout.fieldOrder ||= {};
    layout.fieldOrder[layer] ||= [];

    const entity = Library.getEntity(entityId);
    const defaultMyPracticeFields = ["Meaning", "Uses", "PairsWith", "Substitutions", "Notes"];
    const customFields = (layout.customFields || []).map((field) => field.key);

    const fieldKeys =
      layer === "myPractice"
        ? [...defaultMyPracticeFields, ...customFields]
        : Object.keys(entity?.[layer] || {}).filter((key) => key !== "tags");

    const order = layout.fieldOrder[layer].length ? layout.fieldOrder[layer] : fieldKeys;
    const index = order.indexOf(field);
    const newIndex = index + direction;

    if (index >= 0 && newIndex >= 0 && newIndex < order.length) {
      const [moved] = order.splice(index, 1);
      order.splice(newIndex, 0, moved);
    }

    layout.fieldOrder[layer] = order;
    saveLibraryPageLayout(entityId, layout);
    await renderLibraryEntity(entityId);
    return;
  }

  if (toggleFieldButton) {
    const entityId = toggleFieldButton.dataset.toggleLibraryField;
    const layer = toggleFieldButton.dataset.layer;
    const field = toggleFieldButton.dataset.field;

    const layout = getLibraryPageLayout(entityId);
    layout.hiddenFields ||= {};
    layout.hiddenFields[layer] ||= [];

    if (layout.hiddenFields[layer].includes(field)) {
      layout.hiddenFields[layer] = layout.hiddenFields[layer].filter((item) => item !== field);
    } else {
      layout.hiddenFields[layer].push(field);
    }

    saveLibraryPageLayout(entityId, layout);
    await renderLibraryEntity(entityId);
    return;
  }

  if (createEntryButton) {
    openCreateLibraryEntryModal();
    return;
  }

  if (closeEntryModalButton) {
    closeCreateLibraryEntryModal();
    return;
  }

  if (myPracticeToggle) {
    const shelf = myPracticeToggle.closest("[data-my-practice-shelf]");
    const list = shelf?.querySelector("[data-my-practice-list]");
    if (!list) return;

    list.hidden = !list.hidden;
    return;
  }

  if (myPracticeTypeToggle) {
    const type = myPracticeTypeToggle.dataset.myPracticeTypeToggle;
    const shelf = myPracticeTypeToggle.closest("[data-my-practice-shelf]");
    const list = shelf?.querySelector(`[data-my-practice-type-list="${type}"]`);
    const icon = myPracticeTypeToggle.querySelector("span");

    if (!list) return;

    list.hidden = !list.hidden;

    if (icon) {
      icon.textContent = list.hidden ? "▸" : "▾";
    }

    return;
  }

  if (editEntryButton) {
    openEditLibraryEntryModal(editEntryButton.dataset.editLibraryEntry);
    return;
  }

  if (deleteEntryButton) {
    await deleteLibraryEntryFromMyPractice(deleteEntryButton.dataset.deleteLibraryEntry);
    return;
  }

  if (closeEditModalButton) {
    closeEditLibraryEntryModal();
    return;
  }

  if (toggleLibraryEditButton) {
  libraryEditMode = !libraryEditMode;
  await renderLibraryEntity(toggleLibraryEditButton.dataset.toggleLibraryEdit);
  return;
}

document.addEventListener("change", async (event) => {
  const imageInput = event.target.closest("[data-upload-library-image]");
  if (!imageInput) return;

  const entityId = imageInput.dataset.uploadLibraryImage;
  const file = imageInput.files?.[0];

  if (!file || typeof Library === "undefined") return;

  const image = await readLibraryImageFile(file);

  Library.updateEntityImage(entityId, image);

  await renderLivingLibraryShelves();
  await renderLibraryEntity(entityId);

  flashStatus("Image updated.");
});

document.addEventListener("input", (event) => {
  const searchInput = event.target.closest("[data-library-page-search]");
  if (!searchInput) return;

  const term = searchInput.value.trim().toLowerCase();
  renderGlobalLibrarySearchResults(term);
  const page = document.querySelector(".book-library-entity-page");
  if (!page) return;

  page.querySelectorAll(".library-search-hidden").forEach((item) => {
    item.classList.remove("library-search-hidden");
  });

  page.querySelectorAll(".library-search-match").forEach((item) => {
    item.classList.remove("library-search-match");
  });

  if (!term) return;

  const searchableItems = page.querySelectorAll(
    ".book-library-field, .book-library-related-group, .book-library-intro"
  );

  searchableItems.forEach((item) => {
    const matches = item.textContent.toLowerCase().includes(term);

    if (matches) {
      item.classList.add("library-search-match");
    } else {
      item.classList.add("library-search-hidden");
    }
  });
});

if (saveLibraryPracticeButton) {
  await saveLibraryPracticeFromPage(saveLibraryPracticeButton.dataset.saveLibraryPractice);
  return;
}

if (cancelLibraryEditButton) {
  libraryEditMode = false;
  await renderLibraryEntity(activeLibraryEntityId);
  return;
}

  if (libraryEntityButton) {
    await renderLibraryEntity(libraryEntityButton.dataset.libraryEntityId);
    return;
  }

  if (traditionalToggle) {
    const shelf = traditionalToggle.closest("[data-traditional-library-shelf]");
    const list = shelf?.querySelector("[data-traditional-library-list]");
    if (!list) return;

    list.hidden = !list.hidden;
    return;
  }

  if (typeToggle) {
    const type = typeToggle.dataset.libraryTypeToggle;
    const shelf = typeToggle.closest("[data-traditional-library-shelf]");
    const list = shelf?.querySelector(`[data-library-type-list="${type}"]`);
    const icon = typeToggle.querySelector("span");

    if (!list) return;

    list.hidden = !list.hidden;

    if (icon) {
      icon.textContent = list.hidden ? "▸" : "▾";
    }
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-create-library-entry-form]");
  if (!form) return;

  event.preventDefault();

  const entity = createLibraryEntryFromForm(form);

  if (!entity) {
    flashStatus("Entry could not be created.");
    return;
  }

  closeCreateLibraryEntryModal();

  await renderLivingLibraryShelves();
  await renderLibraryEntity(entity.id);

  flashStatus("Entry created.");
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-edit-library-entry-form]");
  if (!form) return;

  event.preventDefault();

  const entity = await updateLibraryEntryFromForm(form);

  if (!entity) {
    flashStatus("Entry could not be saved.");
    return;
  }

  closeEditLibraryEntryModal();

  await renderLivingLibraryShelves();
  await renderLibraryEntity(entity.id);

  flashStatus("Entry saved.");
});

window.addEventListener("saltSettingsChanged", async () => {
  cachedLibraryPageSettings = null;

  if (activeLibraryEntityId) {
    await renderLibraryEntity(activeLibraryEntityId);
  }
});

/* =========================================================
   STARTUP
   ========================================================= */

updateMundaneModeUI();

document.addEventListener("saltAuthReady", updateAuthState);
document.addEventListener("saltAuthChanged", updateAuthState);
document.addEventListener("saltAuthSuccess", updateAuthState);
document.addEventListener("saltAuthSignedOut", updateAuthState);
/* =========================================================
   ALTAR + APOTHECARY IMPORTS
   ========================================================= */

const APOTHECARY_GRIMOIRE_HANDOFF_KEY = "saltAndSovereigntyApothecaryToGrimoire";

async function getOrCreateAltarBornSection() {
  const user = requireUser();
  if (!user || !currentBook) return null;

  let section = sections.find((item) => item.title === "Altar-Born Pages");

  if (section) return section;

  const { data, error } = await db
    .from("grimoire_sections")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      title: "Altar-Born Pages",
      sort_order: sections.length,
      is_collapsed: false
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return null;
  }

  sections.push(data);
  return data;
}

async function createApothecaryPageFromImport(item) {
  const user = requireUser();

  if (!user || !currentBook || !item) {
    setStatus("Sign in to create an apothecary page.");
    return;
  }

  const title = item.title || item.name || "Apothecary Working";
  const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];

  const altarBornSection = await getOrCreateAltarBornSection();

  const { data: page, error } = await db
    .from("grimoire_pages")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      section_id: altarBornSection?.id || null,
      title,
      icon: "",
      page_type: "apothecary",
      metadata: {
        source: "apothecary",
        apothecary_item_id: item.itemId || "",
        apothecary_type: item.type || "",
        apothecary_type_label: item.typeLabel || item.type || "Apothecary Item",
        intention: item.intention || "",
        notes: item.notes || "",
        ingredients,
        created_at: item.createdAt || new Date().toISOString()
      },
      sort_order: pages.length
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  pages.push(page);
  currentPage = page;

  const ingredientText = ingredients
    .map((ingredient) => ingredient.label || "Unnamed ingredient")
    .join("\n");

  const blocks = [
    {
      type: "text",
      content: ""
    }
  ];

  const rows = blocks.map((block, index) => ({
    user_id: user.id,
    book_id: currentBook.id,
    page_id: page.id,
    block_type: block.type,
    content: block.content || "",
    metadata: {
      source: "apothecary",
      apothecary_item_id: item.itemId || ""
    },
    rich_content: null,
    sort_order: index
  }));

  const { data: createdBlocks, error: blockError } = await db
    .from("grimoire_blocks")
    .insert(rows)
    .select();

  if (blockError) {
    setStatus(blockError.message);
    return;
  }

  currentBlocks = createdBlocks || [];
  pageLinks = [];

  renderShelf();
  await openPage(page.id, "edit");

  localStorage.removeItem(APOTHECARY_GRIMOIRE_HANDOFF_KEY);

  flashStatus("Apothecary page created.");
}

window.addEventListener("load", () => {
  const altarHandoff = localStorage.getItem(ALTAR_GRIMOIRE_HANDOFF_KEY);

  if (altarHandoff) {
    try {
      const ritual = JSON.parse(altarHandoff);
      openAltarImportModal(ritual);
      return;
    } catch (error) {
      console.error(error);
      localStorage.removeItem(ALTAR_GRIMOIRE_HANDOFF_KEY);
    }
  }

  const apothecaryHandoff = localStorage.getItem(APOTHECARY_GRIMOIRE_HANDOFF_KEY);

  if (!apothecaryHandoff) return;

  window.setTimeout(async () => {
    try {
      const item = JSON.parse(apothecaryHandoff);
      await createApothecaryPageFromImport(item);
    } catch (error) {
      console.error(error);
      localStorage.removeItem(APOTHECARY_GRIMOIRE_HANDOFF_KEY);
      setStatus("The apothecary page could not be created.");
    }
  }, 800);
});

const menuButton = null;
const sidebarOverlay = document.getElementById("grimoireSidebarOverlay");

function getSidebar() {
  return document.querySelector(".book-sidebar")
    || document.querySelector(".book-toc")
    || document.querySelector(".grimoire-sidebar");
}

function openGrimoireSidebar() {
  const sidebar = getSidebar();
  if (!sidebar) return;

  sidebar.classList.add("mobile-open");
  sidebarOverlay?.classList.add("show");
  document.body.classList.add("toc-open");
}

function closeGrimoireSidebar() {
  const sidebar = getSidebar();

  sidebar?.classList.remove("mobile-open");
  sidebarOverlay?.classList.remove("show");
  document.body.classList.remove("toc-open");
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-grimoire-menu-button]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  if (document.body.classList.contains("toc-open")) {
    closeGrimoireSidebar();
  } else {
    openGrimoireSidebar();
  }
});

sidebarOverlay?.addEventListener("click", closeGrimoireSidebar);

document.addEventListener("pointerdown", (event) => {
  if (window.innerWidth > 900) return;
  if (!document.body.classList.contains("toc-open")) return;

  const sidebar = getSidebar();

  if (!sidebar) return;
  if (sidebar.contains(event.target)) return;
  if (event.target.closest("[data-grimoire-menu-button]")) return;

  closeGrimoireSidebar();
});

document.addEventListener("click", (event) => {
  if (window.innerWidth > 900) return;

  if (
    event.target.closest("[data-library-entity-id]") ||
    event.target.closest(".book-page-link")
  ) {
    closeGrimoireSidebar();
  }
});

