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

function cleanupDeletedApothecaryLibraryEntries() {
  if (typeof Library === "undefined") return;

  let savedApothecaryItems = [];

  if (typeof getApothecaryItems === "function") {
    savedApothecaryItems = getApothecaryItems();
  } else {
    try {
      savedApothecaryItems =
        JSON.parse(localStorage.getItem("saltAndSovereigntyApothecaryItems")) || [];
    } catch {
      savedApothecaryItems = [];
    }
  }

  const savedIds = new Set(savedApothecaryItems.map((item) => item.id));

  Object.values(Library.exportLibrary().entities || {}).forEach((entity) => {
    if (entity.type !== "apothecary") return;

    const apothecaryItemId =
      entity.metadata?.apothecaryItemId ||
      entity.metadata?.apothecary_item_id ||
      entity.myPractice?.ApothecaryItemId ||
      "";

    const hasKnownItemId = Boolean(apothecaryItemId);
    const stillExists = hasKnownItemId && savedIds.has(apothecaryItemId);

    if (hasKnownItemId && !stillExists && typeof Library.removeEntity === "function") {
      Library.removeEntity(entity.id);
    }
  });
}

function cleanupOrphanedApothecaryLibraryEntries() {
  if (typeof Library === "undefined") return;

  let savedApothecaryItems = [];

  try {
    savedApothecaryItems =
      JSON.parse(localStorage.getItem("saltAndSovereigntyApothecaryItems")) || [];
  } catch {
    savedApothecaryItems = [];
  }

  const savedIds = new Set(
    savedApothecaryItems
      .map((item) => item.id)
      .filter(Boolean)
  );

  Object.values(Library.exportLibrary().entities || {}).forEach((entity) => {
    if (entity.type !== "apothecary") return;

    const linkedApothecaryItemId =
      entity.metadata?.apothecaryItemId ||
      entity.metadata?.apothecary_item_id ||
      entity.myPractice?.ApothecaryItemId ||
      entity.myPractice?.apothecaryItemId ||
      "";

    if (!linkedApothecaryItemId) return;
    if (savedIds.has(linkedApothecaryItemId)) return;

    if (typeof Library.removeEntity === "function") {
      Library.removeEntity(entity.id);
    }
  });
}

async function deleteLegacyGrimoireSections() {
  const user = requireUser();

  if (!user || !currentBook || typeof db === "undefined") return;

  const legacyTitles = [
    "Altar-Born Pages",
    "Traditional Information"
  ];

  const legacySections = sections.filter((section) => {
    return legacyTitles.includes(section.title);
  });

  if (!legacySections.length) return;

  const legacySectionIds = legacySections.map((section) => section.id);

  const { error: pageError } = await db
    .from("grimoire_pages")
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", currentBook.id)
    .in("section_id", legacySectionIds);

  if (pageError) {
    console.error(pageError);
    setStatus("Could not remove old grimoire pages.");
    return;
  }

  const { error: sectionError } = await db
    .from("grimoire_sections")
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", currentBook.id)
    .in("id", legacySectionIds);

  if (sectionError) {
    console.error(sectionError);
    setStatus("Could not remove old grimoire sections.");
    return;
  }

  pages = pages.filter((page) => !legacySectionIds.includes(page.section_id));
  sections = sections.filter((section) => !legacySectionIds.includes(section.id));

  if (currentPage && legacySectionIds.includes(currentPage.section_id)) {
    currentPage = null;
    currentBlocks = [];
    pageLinks = [];
  }
}

async function initGrimoire() {
  const user = requireUser();
  if (!user) return;

  try {
    const initializationStartedAt = performance.now();
    const reportTiming = (label, startedAt = initializationStartedAt) => {
      console.info(`[Grimoire timing] ${label}: ${Math.round((performance.now() - startedAt) * 10) / 10}ms`);
    };
    setStatus("Opening your Book of Shadows...");

    await loadOrCreateBook(user);
    await loadSections();
    await loadPages();
    window.SanctuarySearchPageSource = pages;
    window.SanctuarySearchSectionSource = sections;

    await deleteLegacyGrimoireSections();

    cleanupOrphanedApothecaryLibraryEntries();
    cleanupDeletedApothecaryLibraryEntries();
    
    const librarySyncPromise = typeof initLivingLibrarySupabaseSync === "function"
      ? initLivingLibrarySupabaseSync().catch((error) => console.warn("Living Library background hydration failed.", error))
      : Promise.resolve();

    // Canonical entities exist independently of whether the Traditional layer
    // is visible. Importing here attaches reference metadata without opening or
    // enabling Traditional pages in the Book of Shadows.
    if (typeof Library !== "undefined" && typeof TraditionalLibrary !== "undefined") {
      Library.importTraditionalLibrary();
    }
    reportTiming("Living Library local initialization");

    if (!cachedLibraryPageSettings && typeof getLocalMySettings === "function") {
      cachedLibraryPageSettings = getLocalMySettings();
    }
    if (typeof getMySettings === "function") {
      getMySettings().then(async (settings) => {
        cachedLibraryPageSettings = settings;
        if (!libraryEditMode && activeLibraryEntityId && Library.getEntity(activeLibraryEntityId)) {
          await renderLibraryEntity(activeLibraryEntityId);
        }
      }).catch((error) => console.warn("Library display settings hydration failed.", error));
    }
    
    const requestedView = new URLSearchParams(window.location.search);
    const requestedEntityId = typeof Library !== "undefined" && typeof Library.resolveCanonicalEntityId === "function"
      ? Library.resolveCanonicalEntityId(requestedView.get("entity"))
      : requestedView.get("entity");
    const requestedPageId = requestedView.get("page");
    const lastView = getLastGrimoireView();
    const lastEntityId = lastView?.type === "library" && typeof Library !== "undefined" && typeof Library.resolveCanonicalEntityId === "function"
      ? Library.resolveCanonicalEntityId(lastView.id)
      : lastView?.id;

    if (requestedEntityId && typeof Library !== "undefined" && Library.getEntity(requestedEntityId)) {
      renderWelcomeState();
      renderShelf();
      await renderLibraryEntity(requestedEntityId);
      reportTiming("canonical entity first render");
      renderLivingLibraryShelves();
    } else if (requestedPageId && pages.some((page) => page.id === requestedPageId)) {
      await openPage(requestedPageId, "read");
      await renderLivingLibraryShelves();
    } else if (lastView?.type === "library" && lastEntityId && typeof Library !== "undefined") {
      renderWelcomeState();
      renderShelf();
      await renderLibraryEntity(lastEntityId);
      reportTiming("canonical entity first render");
      renderLivingLibraryShelves();
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

    librarySyncPromise.then(async () => {
      reportTiming("background Supabase hydration complete");
      await renderLivingLibraryShelves();
      if (!libraryEditMode && activeLibraryEntityId && Library.getEntity(activeLibraryEntityId)) {
        await renderLibraryEntity(activeLibraryEntityId);
        reportTiming("hydrated entity refresh");
      }
    });

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

  document.body.classList.remove("library-page-open");

  if (entryList) entryList.innerHTML = "";
  if (grimoireHeading) grimoireHeading.textContent = "Welcome";

  showEmptyState();
  updateEditButton();
}

async function openPage(pageId, mode = "read") {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return;

  activeLibraryEntityId = null;
  document.body.classList.remove("library-page-open");

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
    page._searchBlocks = structuredClone(currentBlocks);
    window.SanctuarySearchPageSource = pages;
    document.dispatchEvent(new CustomEvent("sanctuary-search:sources-changed"));
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
  const settings = await getMySettings();

  if (settings.library_myPractice_enabled === false) {
      return;
  }
  
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
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
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
  if (!entity) return "";

  if (entity.type === "apothecary") {
    return `${formatLibraryEntityName(entity.name)} is part of My Practice.`;
  }

  const traditional = entity.traditional || {};
  const uses = traditional.Uses || traditional.Domains || traditional.Purpose || "";

  if (uses) {
    return `${formatLibraryEntityName(entity.name)} is traditionally associated with ${String(uses).toLowerCase()}.`;
  }

  if (Object.keys(entity.myPractice || {}).length) {
    return `${formatLibraryEntityName(entity.name)} is part of My Practice.`;
  }

  return `${formatLibraryEntityName(entity.name)} is part of the Living Library.`;
}

function normalizeLibraryImageName(name = "") {
  return String(name)
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");
}

function getDefaultLibraryImage(entity) {
  if (!entity) return "";

  const entityName = normalizeLibraryImageName(entity.name);

  if (typeof cabinetItems === "undefined") return "";

  const matchingItem = cabinetItems.find((item) => {
    const itemName = normalizeLibraryImageName(item.name);

    if (itemName === entityName) return true;

    return (item.forms || []).some((form) => {
      return (
        normalizeLibraryImageName(form.herb) === entityName ||
        normalizeLibraryImageName(form.crystal) === entityName ||
        normalizeLibraryImageName(form.tool) === entityName ||
        normalizeLibraryImageName(form.vessel) === entityName ||
        normalizeLibraryImageName(form.deity) === entityName ||
        normalizeLibraryImageName(form.color + " candle") === entityName
      );
    });
  });

  if (!matchingItem) return "";

  if (normalizeLibraryImageName(entity.type) === "herb") {
    const looseForm = matchingItem.forms?.find((form) => {
      return normalizeLibraryImageName(form.form) === "loose";
    });

    if (looseForm?.image) return looseForm.image;
  }

  return matchingItem.forms?.find((form) => form.image)?.image || "";
}

function getLibraryDisplayImage(entity) {
  return entity?.image || getDefaultLibraryImage(entity);
}

function openLibraryImageManager(entityId) {
  if (typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  const displayImage = getLibraryDisplayImage(entity);
  const isCustom = Boolean(entity.image);

  const modal = document.createElement("div");
  modal.className = "book-modal-backdrop";
  modal.setAttribute("data-library-image-manager", "");

  modal.innerHTML = `
    <div class="book-modal" role="dialog" aria-modal="true" aria-label="Manage library image">
      <header>
        <h2>Image</h2>
        <button type="button" data-close-library-image-manager aria-label="Close">×</button>
      </header>

      <div class="book-modal-body">
        <div class="library-image-manager">
          ${
            displayImage
              ? `
                <figure class="book-library-hero-image">
                  <img src="${displayImage}" alt="${escapeHtml(entity.name)}" />
                </figure>
              `
              : `<p class="book-placeholder">No image is available yet.</p>`
          }

          <p class="book-section-empty">
            ${isCustom ? "Using custom image." : "Using default image."}
          </p>

          <label>
            Upload Custom Image
            <input type="file" accept="image/png,image/jpeg,image/webp" data-library-image-upload="${entity.id}" />
          </label>

          <div class="button-row">
            <button class="button button--small" type="button" data-restore-default-library-image="${entity.id}">
              Restore Default
            </button>

            <button class="button button--small button--ghost" type="button" data-close-library-image-manager>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeLibraryImageManager() {
  document.querySelector("[data-library-image-manager]")?.remove();
}

async function uploadLibraryImageToSupabase(entityId, file) {
  const user = requireUser();

  if (!user || !file || typeof db === "undefined" || typeof Library === "undefined") return null;

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeEntityId = String(entityId).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = `${user.id}/${safeEntityId}-${Date.now()}.${extension}`;

  const { error: uploadError } = await db.storage
    .from("living-library-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    console.error(uploadError);
    flashStatus(uploadError.message || "Image could not be uploaded.");
    return null;
  }

  const { data } = db.storage
    .from("living-library-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
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
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const amount = item.amount ? `${item.amount} ` : "";
          const name =
            item.libraryName ||
            item.label ||
            item.name ||
            item.herb ||
            item.crystal ||
            item.tool ||
            item.vessel ||
            item.deity ||
            item.type ||
            "Ingredient";

          return escapeHtml(`${amount}${name}`.trim());
        }

        return escapeHtml(item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    const label =
      value.libraryName ||
      value.label ||
      value.name ||
      value.herb ||
      value.crystal ||
      value.tool ||
      value.vessel ||
      value.deity ||
      value.type ||
      "";

    return label ? escapeHtml(label) : escapeHtml(JSON.stringify(value));
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

  return settings.library_traditional_enabled !== false;
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

  const cloudResult = typeof flushLivingLibraryEntitySave === "function"
    ? await flushLivingLibraryEntitySave(entityId)
    : { saved: false, localOnly: true };

  libraryEditMode = false;

  await renderLivingLibraryShelves();
  await renderLibraryEntity(entityId);

  flashStatus(cloudResult?.error
    ? "My Practice saved locally. Cloud sync will retry later."
    : "My Practice saved.");
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

function formatRitualDuration(seconds) {
  const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  if (!totalMinutes) return "Not recorded";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours ? `${hours} hr` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ");
}

function renderRitualRecord(entity) {
  const practice = entity.myPractice || {};
  const section = (title, value) => value ? `<section class="ritual-record-section"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(value)}</p></section>` : "";
  const altarItems = Array.isArray(practice.AltarItems) ? practice.AltarItems : [];
  const templateId = practice.RitualTemplateId || entity.metadata?.ritualTemplateId;
  return `
    <article class="ritual-record" data-canonical-ritual-record>
      <dl class="ritual-record-facts">
        ${practice.Date ? `<div><dt>Date</dt><dd>${escapeHtml(new Date(`${practice.Date}T12:00:00`).toLocaleDateString([], { dateStyle: "long" }))}</dd></div>` : ""}
        ${practice.TimeOfDay ? `<div><dt>Time of day</dt><dd>${escapeHtml(practice.TimeOfDay)}</dd></div>` : ""}
        <div><dt>Duration</dt><dd>${escapeHtml(formatRitualDuration(practice.DurationSeconds))}</dd></div>
        ${templateId ? `<div><dt>Source template</dt><dd><button type="button" class="book-living-connection-link" data-library-entity-id="${escapeHtml(`ritual-template:${templateId}`)}">View template</button></dd></div>` : ""}
      </dl>
      ${section("Intention", practice.Intention)}
      ${altarItems.length ? `<section class="ritual-record-section"><h2>The Altar</h2><div class="ritual-record-chips">${altarItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></section>` : ""}
      ${section("What Happened", [practice.WhatHappenedDuring, practice.WhatHappenedAfter].filter(Boolean).join("\n\n"))}
      ${section("Feelings and Impressions", [practice.FeelingsBefore, practice.FeelingsDuring, practice.FeelingsAfter].filter(Boolean).join("\n\n"))}
      ${section("Signs and Symbols", practice.SignsAndSymbols)}
      ${section("Results and Follow-Up", [practice.Results, practice.DreamsAndFollowUp, practice.ChangesForNextTime].filter(Boolean).join("\n\n"))}
      ${section("Private Notes", practice.Notes)}
      <details class="ritual-record-details"><summary>Record details</summary><p>Canonical record: ${escapeHtml(entity.id)}</p></details>
    </article>`;
}

function renderRitualTemplateRecord(entity) {
  const practice = entity.myPractice || {};
  const templateId = practice.RitualTemplateId || entity.metadata?.ritualTemplateId;
  const rows = [["Purpose and Intention", practice.Purpose], ["Preparation", practice.Preparation], ["Estimated Duration", formatRitualDuration(practice.EstimatedDurationSeconds)], ["Closing", practice.Closing]];
  return `<article class="ritual-record ritual-template-record" data-canonical-ritual-template-record>
    ${rows.filter(([, value]) => value).map(([label, value]) => `<section class="ritual-record-section"><h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p></section>`).join("")}
    ${templateId ? `<a class="button button--primary" href="../altar/?editRitualTemplate=${encodeURIComponent(templateId)}">Begin or Edit Ritual</a>` : ""}
  </article>`;
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

let livingJourneyRequestId = 0;

function renderJourneyRecord(record) {
  const content = `
    <strong>${escapeHtml(record.label)}</strong>
    ${record.type ? `<small>${escapeHtml(record.type)}</small>` : ""}
    ${record.relation ? `<small>${escapeHtml(record.relation)}</small>` : ""}
    ${record.date ? `<small>${escapeHtml(record.date)}</small>` : ""}
  `;
  if (record.entityId) {
    return `<button type="button" class="book-living-connection-link" data-library-entity-id="${escapeHtml(record.entityId)}">${content}</button>`;
  }
  if (record.href) return `<a class="book-living-connection-link" href="${escapeHtml(record.href)}">${content}</a>`;
  return `<span class="book-living-connection-record">${content}</span>`;
}

function renderJourneyEvent(event) {
  return `
    <li class="book-living-timeline-event">
      <time datetime="${escapeHtml(event.timestamp)}">${escapeHtml(event.date)}</time>
      ${event.href ? `<a href="${escapeHtml(event.href)}">${escapeHtml(event.label)}</a>` : `<strong>${escapeHtml(event.label)}</strong>`}
      ${event.context ? `<p>${escapeHtml(event.context)}</p>` : ""}
    </li>`;
}

function renderLivingJourney(model) {
  if (!model) return "";
  const summary = model.summary.length ? `
    <dl class="book-living-journey-summary">
      ${model.summary.map((row) => `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`).join("")}
    </dl>` : "";
  const pairings = model.pairings.length ? `
    <section class="book-living-journey-group">
      <h3>Frequently Paired With</h3>
      <div class="book-living-pairings">
        ${model.pairings.map((pairing) => `
          <button type="button" class="book-living-connection-link" data-library-entity-id="${escapeHtml(pairing.entityId)}">
            <strong>${escapeHtml(pairing.label)}</strong>
            <small>${escapeHtml(pairing.type)} · ${escapeHtml(pairing.description)}</small>
          </button>`).join("")}
      </div>
    </section>` : "";
  const references = model.referenceGroups.length ? `
    <section class="book-living-journey-group">
      <h3>Appears Within</h3>
      <div class="book-living-reference-groups">
        ${model.referenceGroups.map((group) => `
          <section>
            <h4>${escapeHtml(group.label)}</h4>
            <div class="book-living-record-list">${group.visible.map(renderJourneyRecord).join("")}</div>
            ${group.remaining.length ? `
              <details>
                <summary>View all ${group.total}</summary>
                <div class="book-living-record-list">${group.remaining.map(renderJourneyRecord).join("")}</div>
              </details>` : ""}
          </section>`).join("")}
      </div>
    </section>` : "";
  const timeline = model.recentEvents.length ? `
    <section class="book-living-journey-group">
      <h3>Recent Activity</h3>
      <ol class="book-living-timeline">${model.recentEvents.map(renderJourneyEvent).join("")}</ol>
      ${model.olderEvents.length ? `
        <details class="book-living-full-timeline">
          <summary>View Full Timeline</summary>
          <ol class="book-living-timeline">${model.olderEvents.map(renderJourneyEvent).join("")}</ol>
        </details>` : ""}
    </section>` : "";

  return `
    <div class="library-section-heading-row"><h2>Your Journey with ${escapeHtml(model.entityName)}</h2></div>
    ${model.emptyMessage ? `<p class="book-placeholder">${escapeHtml(model.emptyMessage)}</p>` : ""}
    ${summary}${pairings}${references}${timeline}
  `;
}

async function hydrateLivingJourney(entityId, requestId) {
  const target = [...document.querySelectorAll("[data-living-journey]")]
    .find((section) => section.dataset.livingJourney === entityId);
  if (!target || typeof LivingConnections === "undefined" || typeof LivingConnectionsView === "undefined") return;
  const startedAt = performance.now();
  try {
    const result = await LivingConnections.load(entityId);
    console.info(`[Grimoire timing] LivingConnections load: ${Math.round((performance.now() - startedAt) * 10) / 10}ms`);
    if (!LivingConnectionsView.isCurrentRequest(requestId, livingJourneyRequestId, entityId, activeLibraryEntityId) || !target.isConnected) return;
    target.innerHTML = renderLivingJourney(LivingConnectionsView.createJourneyModel(result));
  } catch (error) {
    console.warn("Living Connections could not be loaded for this entry.", error);
    if (requestId === livingJourneyRequestId && target.isConnected) target.remove();
  }
}

async function renderLibraryEntity(entityId) {
  const renderStartedAt = performance.now();
  if (!entryList || typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  activeLibraryEntityId = entityId;
  document.body.classList.add("library-page-open");
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
  const renderedLayers = !libraryEditMode && entity.type === "ritual"
    ? renderRitualRecord(entity)
    : !libraryEditMode && entity.type === "ritual_template"
      ? renderRitualTemplateRecord(entity)
      : renderLibraryLayers(entity, settings, layout);
  const entityImage = getLibraryDisplayImage(entity);

  const journeyRequestId = ++livingJourneyRequestId;
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
              `
                <button class="button button--small" type="button" data-toggle-library-edit="${entity.id}">
                  ${libraryEditMode
                    ? "Preview"
                    : Object.keys(entity.myPractice || {}).length
                      ? "Edit My Practice"
                      : "Add My Practice"}
                </button>

                <button class="button button--small button--ghost" type="button" data-open-library-image-manager="${entity.id}">
                  Image
                </button>

                ${Object.keys(entity.myPractice || {}).length || entity.type === "apothecary" ? `
                  <button class="button button--small button--ghost" type="button" data-delete-library-entry="${entity.id}">
                    Del
                  </button>
                ` : ""}
              `
            }
          </div>

          <label class="book-library-mundane-toggle">
           <input type="checkbox" data-mundane-toggle ${document.body.classList.contains("mundane-mode") ? "checked" : ""} />
           <span data-mundane-label>Mundane</span>
         </label>
        </div>
      <header class="book-reader-header book-library-header">

        <h1>${formatLibraryEntityName(entity.name)}</h1>

        ${entityImage ? `
          <figure class="book-library-hero-image">
            <img src="${entityImage}" alt="${escapeHtml(entity.name)}" />
          </figure>
        ` : ""}

        <p class="book-library-intro">
          ${escapeHtml(getLibraryEntityIntro(entity))}
        </p>

        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>

      </header>

      <div class="book-reader-body book-library-body">
        ${renderedLayers}
        <section class="book-library-layer book-library-journey" data-living-journey="${escapeHtml(entity.id)}" aria-live="polite">
          <div class="library-section-heading-row"><h2>Your Journey with ${escapeHtml(entity.name)}</h2></div>
          <p class="book-placeholder">Gathering the connections held in your practice…</p>
        </section>
      </div>
    </section>
  `;

  renderLivingLibraryShelves();
  hydrateLivingJourney(entity.id, journeyRequestId);
  console.info(`[Grimoire timing] entity rendering: ${Math.round((performance.now() - renderStartedAt) * 10) / 10}ms`);
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
          <fieldset class="book-library-entry-step">
            <legend>1. Choose a category</legend>
            <label>
              Category
              <select name="type" data-library-entry-type required>
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
          </fieldset>

          <fieldset class="book-library-entry-step">
            <legend>2. Find or create the entity</legend>
            <p class="book-section-empty">Search the canonical Traditional Library, even when that layer is hidden.</p>
            <label>
              Search
              <input type="search" data-library-entry-search placeholder="Start typing, such as Bas..." autocomplete="off" />
            </label>
            <input type="hidden" name="name" data-library-entry-name />
            <input type="hidden" name="traditionalReference" data-library-entry-reference />
            <input type="hidden" name="entryMode" data-library-entry-mode />
            <div class="book-library-entry-results" data-library-entry-results role="listbox" aria-label="Matching entities"></div>
            <p class="book-library-entry-selection" data-library-entry-selection role="status">Choose a Traditional entry or create a custom entity.</p>
          </fieldset>

          <fieldset class="book-library-entry-step">
            <legend>3. Add My Practice</legend>
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
          </fieldset>

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

function renderCreateLibraryEntryResults(form) {
  if (!form || typeof Library === "undefined") return;

  const type = String(form.elements.type?.value || "").trim();
  const search = String(form.querySelector("[data-library-entry-search]")?.value || "").trim();
  const results = form.querySelector("[data-library-entry-results]");
  if (!results) return;

  const matches = Library.searchTraditionalEntries(type, search).slice(0, 8);
  const matchMarkup = matches.map((entry) => `
    <button class="button button--small button--ghost" type="button" role="option"
      data-select-traditional-entry="${escapeHtml(entry.reference)}"
      data-traditional-entry-name="${escapeHtml(entry.name)}">
      ${escapeHtml(entry.name)} <small>— ${escapeHtml(getMyPracticeTypeLabel(entry.type).replace(/s$/, ""))}</small>
    </button>
  `).join("");

  const customMarkup = search ? `
    <button class="button button--small" type="button" data-create-custom-library-entity="${escapeHtml(search)}">
      Create custom entity “${escapeHtml(search)}”
    </button>
  ` : "";

  results.innerHTML = matchMarkup || customMarkup
    ? `${matchMarkup}${customMarkup}`
    : `<p class="book-section-empty">Type a name to search or create a custom entity.</p>`;
}

function selectCreateLibraryEntryEntity(form, { name, reference = null, mode }) {
  const nameInput = form?.querySelector("[data-library-entry-name]");
  const referenceInput = form?.querySelector("[data-library-entry-reference]");
  const modeInput = form?.querySelector("[data-library-entry-mode]");
  const selection = form?.querySelector("[data-library-entry-selection]");
  if (!nameInput || !referenceInput || !modeInput || !selection) return;

  nameInput.value = name;
  referenceInput.value = reference || "";
  modeInput.value = mode;
  if (!name || !mode) {
    selection.textContent = "Choose a Traditional entry or create a custom entity.";
    return;
  }
  selection.textContent = reference
    ? `Selected ${name}. My Practice will be attached to ${reference}.`
    : `Selected custom entity ${name}. It will not have Traditional Information.`;
}

function createLibraryEntryFromForm(form) {
  if (typeof Library === "undefined") return null;

  const formData = new FormData(form);
  const type = String(formData.get("type") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const traditionalReference = String(formData.get("traditionalReference") || "").trim();
  const entryMode = String(formData.get("entryMode") || "").trim();

  if (!type || !name || !entryMode) return null;

  let entity = traditionalReference
    ? Library.getOrCreateTraditionalEntity(traditionalReference)
    : null;

  if (!entity && entryMode === "custom") {
    entity = Object.values(Library.exportLibrary().entities || {}).find((candidate) => {
      return candidate.type === type &&
        candidate.name.trim().toLowerCase() === name.toLowerCase() &&
        candidate.metadata?.traditionalReference === null;
    }) || Library.createEntity({
      name,
      type,
      metadata: { traditionalReference: null }
    });
  }

  if (!entity) return null;

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

  const isApothecaryEntry = entity.type === "apothecary";

  const confirmed = window.confirm(
    isApothecaryEntry
      ? `Delete "${formatLibraryEntityName(entity.name)}" from My Practice and My Apothecary? This cannot be undone.`
      : `Delete your My Practice notes for "${formatLibraryEntityName(entity.name)}"? The traditional entry will remain if it exists.`
  );

  if (!confirmed) return;

  if (isApothecaryEntry) {
    const user = requireUser();

    const apothecaryItemId =
      entity.metadata?.apothecaryItemId ||
      entity.metadata?.apothecary_item_id ||
      entity.myPractice?.ApothecaryItemId ||
      entity.myPractice?.apothecaryItemId ||
      "";

    if (user && apothecaryItemId && typeof db !== "undefined") {
      const { error } = await db
        .from("apothecary_items")
        .delete()
        .eq("user_id", user.id)
        .eq("id", apothecaryItemId);

      if (error) {
        console.error(error);
        flashStatus("Could not delete the matching apothecary item.");
        return;
      }
    }

    if (typeof deleteLivingLibraryEntityFromSupabase === "function") {
      await deleteLivingLibraryEntityFromSupabase(entityId);
    }

    if (typeof Library.removeEntity === "function") {
      Library.removeEntity(entityId);
    }

    activeLibraryEntityId = null;
    libraryEditMode = false;

    await renderLivingLibraryShelves();
    renderWelcomeState();

    flashStatus("Apothecary entry removed from My Practice and My Apothecary.");
    return;
  }

  Library.updateEntity(entityId, {
    myPractice: {}
  });

  if (typeof saveLivingLibraryEntityToSupabase === "function") {
    await saveLivingLibraryEntityToSupabase(entityId);
  }

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
  const openImageManagerButton = event.target.closest("[data-open-library-image-manager]");
  const closeImageManagerButton = event.target.closest("[data-close-library-image-manager]");
  const restoreDefaultImageButton = event.target.closest("[data-restore-default-library-image]");
  const traditionalEntryChoice = event.target.closest("[data-select-traditional-entry]");
  const customEntityChoice = event.target.closest("[data-create-custom-library-entity]");

  if (traditionalEntryChoice || customEntityChoice) {
    const choice = traditionalEntryChoice || customEntityChoice;
    const form = choice.closest("[data-create-library-entry-form]");
    if (!form) return;

    if (traditionalEntryChoice) {
      selectCreateLibraryEntryEntity(form, {
        name: traditionalEntryChoice.dataset.traditionalEntryName,
        reference: traditionalEntryChoice.dataset.selectTraditionalEntry,
        mode: "traditional"
      });
    } else {
      selectCreateLibraryEntryEntity(form, {
        name: customEntityChoice.dataset.createCustomLibraryEntity,
        mode: "custom"
      });
    }
    return;
  }

  if (richCommandButton) {
    document.execCommand(
      richCommandButton.dataset.richCommand,
      false,
      richCommandButton.dataset.richValue || null
    );
    return;
  }

  if (openImageManagerButton) {
    openLibraryImageManager(openImageManagerButton.dataset.openLibraryImageManager);
    return;
  }

  if (closeImageManagerButton) {
    closeLibraryImageManager();
    return;
  }

  if (restoreDefaultImageButton) {
    const entityId = restoreDefaultImageButton.dataset.restoreDefaultLibraryImage;

    Library.updateEntityImage(entityId, "");

    if (typeof saveLivingLibraryEntityToSupabase === "function") {
      await saveLivingLibraryEntityToSupabase(entityId);
    }

    closeLibraryImageManager();
    await renderLibraryEntity(entityId);
    flashStatus("Default image restored.");
    return;
  }

  if (toggleLibraryEditButton) {
    libraryEditMode = !libraryEditMode;
    await renderLibraryEntity(toggleLibraryEditButton.dataset.toggleLibraryEdit);
    return;
  }

  if (saveLibraryPracticeButton) {
    await saveLibraryPracticeFromPage(saveLibraryPracticeButton.dataset.saveLibraryPractice);
    return;
  }

  if (cancelLibraryEditButton) {
    libraryEditMode = false;
    await renderLibraryEntity(activeLibraryEntityId);
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
    const customFields = (layout.customFields || []).map((item) => item.key);

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
    if (icon) icon.textContent = list.hidden ? "▸" : "▾";
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
    if (icon) icon.textContent = list.hidden ? "▸" : "▾";
  }
});

document.addEventListener("change", async (event) => {
  const entryType = event.target.closest("[data-library-entry-type]");
  if (entryType) {
    const form = entryType.closest("[data-create-library-entry-form]");
    if (form) {
      selectCreateLibraryEntryEntity(form, { name: "", mode: "" });
      renderCreateLibraryEntryResults(form);
    }
    return;
  }

  const imageInput = event.target.closest("[data-library-image-upload]");
  if (!imageInput) return;

  const entityId = imageInput.dataset.libraryImageUpload;
  const file = imageInput.files?.[0];

  if (!file) return;

  const imageUrl = await uploadLibraryImageToSupabase(entityId, file);
  if (!imageUrl) return;

  Library.updateEntityImage(entityId, imageUrl);

  if (typeof saveLivingLibraryEntityToSupabase === "function") {
    await saveLivingLibraryEntityToSupabase(entityId);
  }

  closeLibraryImageManager();
  await renderLibraryEntity(entityId);
  flashStatus("Image updated.");
});

document.addEventListener("input", (event) => {
  const entrySearch = event.target.closest("[data-library-entry-search]");
  if (entrySearch) {
    const form = entrySearch.closest("[data-create-library-entry-form]");
    if (form) {
      selectCreateLibraryEntryEntity(form, { name: "", mode: "" });
      renderCreateLibraryEntryResults(form);
    }
    return;
  }

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

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-create-library-entry-form]");
  if (!form) return;
  event.preventDefault();

  if (form.dataset.submitting === "true") return;
  form.dataset.submitting = "true";
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const entity = createLibraryEntryFromForm(form);
    if (!entity) {
      flashStatus("Choose a Traditional entry or explicitly create a custom entity.");
      return;
    }

    const cloudResult = typeof flushLivingLibraryEntitySave === "function"
      ? await flushLivingLibraryEntitySave(entity.id)
      : { saved: false, localOnly: true };

    closeCreateLibraryEntryModal();
    await renderLivingLibraryShelves();
    await renderLibraryEntity(entity.id);
    flashStatus(cloudResult?.error
      ? "My Practice entry saved locally. Cloud sync will retry later."
      : "My Practice entry saved.");
  } catch (error) {
    console.error("Could not create My Practice entry:", error);
    flashStatus("The My Practice entry could not be saved. Your form is still open.");
  } finally {
    form.dataset.submitting = "false";
    if (submitButton) submitButton.disabled = false;
  }
});

function updateMundaneModeUI() {
  const isMundane = document.body.classList.contains("mundane-mode");

  document.querySelectorAll("[data-mundane-toggle]").forEach((toggle) => {
    toggle.checked = isMundane;
  });

  document.querySelectorAll("[data-mundane-label]").forEach((label) => {
    label.textContent = isMundane ? "Journal Mode" : "Magickal Mode";
  });

  const heading = document.querySelector(".book-library-header h1");
  if (heading && activeLibraryEntityId && typeof Library !== "undefined") {
    const entity = Library.getEntity(activeLibraryEntityId);
    if (entity) {
      heading.textContent = isMundane
        ? formatLibraryEntityName(entity.name).replace(/\bSpell\b/gi, "Entry").replace(/\bRitual\b/gi, "Reflection")
        : formatLibraryEntityName(entity.name);
    }
  }
}

document.addEventListener("click", (event) => {
  const mundaneLabel = event.target.closest(".book-library-mundane-toggle");
  if (!mundaneLabel) return;

  const checkbox = mundaneLabel.querySelector("[data-mundane-toggle]");
  if (!checkbox) return;

  event.preventDefault();

  setMundaneMode(!checkbox.checked);
});

document.addEventListener("change", (event) => {
  const mundaneToggle = event.target.closest("[data-mundane-toggle]");
  if (!mundaneToggle) return;

  setMundaneMode(mundaneToggle.checked);
});

/* =========================================================
   MUNDANE MODE
   ========================================================= */

const MUNDANE_MODE_KEY = "saltAndSovereigntyMundaneMode";

function updateMundaneModeUI() {
  const isMundane = document.body.classList.contains("mundane-mode");

  document.querySelectorAll("[data-mundane-toggle]").forEach((toggle) => {
    toggle.checked = isMundane;
  });

  document.querySelectorAll("[data-mundane-label]").forEach((label) => {
    label.textContent = "Mundane";
  });

  const eyebrow = document.querySelector(".grimoire-cover .eyebrow, .grimoire-hero-kicker, .book-hero-kicker");
  const title = document.querySelector(".grimoire-cover h1, .grimoire-hero h1, .book-hero h1");
  const tagline = document.querySelector(".grimoire-cover p, .grimoire-hero p, .book-hero p");

  if (title) {
    title.textContent = isMundane ? "Personal Journal" : "Book of Shadows";
  }

  const pageTitle = document.querySelector(".book-library-header h1, .book-reader-header h1");

  if (pageTitle && isMundane) {
    pageTitle.dataset.originalTitle ||= pageTitle.textContent;

    const today = new Date();
    pageTitle.textContent = today.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  if (pageTitle && !isMundane && pageTitle.dataset.originalTitle) {
    pageTitle.textContent = pageTitle.dataset.originalTitle;
    delete pageTitle.dataset.originalTitle;
  }
}

function setMundaneMode(isMundane) {
  document.body.classList.toggle("mundane-mode", isMundane);
  localStorage.setItem(MUNDANE_MODE_KEY, isMundane ? "true" : "false");
  updateMundaneModeUI();
}

function initMundaneMode() {
  setMundaneMode(localStorage.getItem(MUNDANE_MODE_KEY) === "true");
}

document.addEventListener("click", (event) => {
  const mundaneLabel = event.target.closest(".book-library-mundane-toggle");
  if (!mundaneLabel) return;

  const checkbox = mundaneLabel.querySelector("[data-mundane-toggle]");
  if (!checkbox) return;

  event.preventDefault();
  setMundaneMode(!checkbox.checked);
});

document.addEventListener("change", (event) => {
  const mundaneToggle = event.target.closest("[data-mundane-toggle]");
  if (!mundaneToggle) return;

  setMundaneMode(mundaneToggle.checked);
});

/* =========================================================
   STARTUP
   ========================================================= */

initMundaneMode();

document.addEventListener("saltAuthReady", updateAuthState);
document.addEventListener("saltAuthChanged", updateAuthState);
document.addEventListener("saltAuthSuccess", updateAuthState);
document.addEventListener("saltAuthSignedOut", updateAuthState);

/* =========================================================
   ALTAR + APOTHECARY IMPORTS
   ========================================================= */

const APOTHECARY_GRIMOIRE_HANDOFF_KEY = "saltAndSovereigntyApothecaryToGrimoire";

async function getOrCreateAltarBornSection() {
  return null;
}

async function createApothecaryPageFromImport(item) {
  localStorage.removeItem(APOTHECARY_GRIMOIRE_HANDOFF_KEY);
  flashStatus("Apothecary items now live in My Practice instead of Altar-Born Pages.");
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
