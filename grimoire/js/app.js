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

    await renderTraditionalLibraryShelf();

    const lastView = getLastGrimoireView();

    if (lastView?.type === "library" && lastView.id && typeof Library !== "undefined") {
      renderLibraryEntity(lastView.id);
    } else if (lastView?.type === "page" && pages.some((page) => page.id === lastView.id)) {
      await openPage(lastView.id, lastView.mode || "read");
    } else if (pages.length > 0) {
      await openPage(pages[0].id, "read");
    } else {
      renderWelcomeState();
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

function formatLibraryEntityName(name = "") {
  return String(name)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLibraryFieldName(name = "") {
  const labels = {
    PairsWith: "Pairs Well With",
    TraditionalWarnings: "Traditional Notes & Warnings",
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

  return escapeHtml(value);
}

function renderLibraryField(key, value) {
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

  const useChips = chipFields.includes(key);

  return `
    <div class="book-library-field">
      ${
        ["Uses", "TraditionalWarnings"].includes(key)
          ? ""
          : `<h3>${formatLibraryFieldName(key)}</h3>`
      }
      ${
        useChips
          ? renderLibraryChips(value)
          : `<p>${renderLibraryPlainValue(value)}</p>`
      }
    </div>
  `;
}

function groupTraditionalFields(traditional = {}) {
  const groups = [
    {
      title: "Correspondences",
      keys: ["Element", "Planet", "Chakra", "Pantheon"]
    },
    {
      title: "Magical Uses",
      keys: ["Uses", "Domains", "Purpose", "UsedFor", "BestFor"]
    },
    {
      title: "Pairings & Substitutions",
      keys: ["PairsWith", "Substitutions", "BestWith", "Herbs", "Crystals", "CandleColors"]
    },
    {
      title: "Sacred Associations",
      keys: ["SacredSymbols", "SacredAnimals", "SacredPlants", "Offerings"]
    },
    {
      title: "Materials & Care",
      keys: ["TraditionallyMadeFrom", "TraditionallyUsedFor", "CommonMaterials", "Cleansing"]
    },
    {
      title: "Traditional Notes",
      keys: ["TraditionalWarnings"]
    }
  ];

  const usedKeys = new Set();

  const renderedGroups = groups
    .map((group) => {
      const fields = group.keys
        .filter((key) => traditional[key])
        .map((key) => {
          usedKeys.add(key);
          return renderLibraryField(key, traditional[key]);
        })
        .join("");

      if (!fields) return "";

      return `
        <section class="book-library-layer">
          <h2>${group.title}</h2>
          <div class="book-library-fields">
            ${fields}
          </div>
        </section>
      `;
    })
    .join("");

  const extraFields = Object.entries(traditional)
    .filter(([key]) => key !== "tags" && !usedKeys.has(key))
    .map(([key, value]) => renderLibraryField(key, value))
    .join("");

  return `
    ${renderedGroups}
    ${
      extraFields
        ? `
          <section class="book-library-layer">
            <h2>Additional Traditional Notes</h2>
            <div class="book-library-fields">
              ${extraFields}
            </div>
          </section>
        `
        : ""
    }
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

  const types = ["herb", "crystal", "candle", "deity", "tool", "vessel"];

  const wrapper = document.createElement("section");
  wrapper.className = "book-toc-section traditional-library-shelf";
  wrapper.setAttribute("data-traditional-library-shelf", "");

  wrapper.innerHTML = `
    <button class="book-section-title traditional-library-title" type="button" data-traditional-library-toggle>
      <span>Traditional Information</span>
    </button>

    <div class="book-section-pages traditional-library-root" data-traditional-library-list>
      ${types
        .map((type) => {
          const entities = Library.getEntitiesByType(type)
            .filter((entity) => entity.traditional && Object.keys(entity.traditional).length)
            .sort((a, b) => a.name.localeCompare(b.name));

          if (!entities.length) return "";

          return `
            <div class="traditional-library-group" data-traditional-library-group="${type}">
              <button class="traditional-library-group-title" type="button" data-library-type-toggle="${type}">
                <span>▸</span>
                ${getTraditionalTypeLabel(type)}
              </button>

              <div class="traditional-library-entity-list" data-library-type-list="${type}" hidden>
                ${entities
                  .map((entity) => `
                    <button
                      type="button"
                      class="book-page-link traditional-library-entity-link ${activeLibraryEntityId === entity.id ? "is-active" : ""}"
                      data-library-entity-id="${entity.id}">
                      ${formatLibraryEntityName(entity.name)}
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

  grimoireShelf.appendChild(wrapper);

  if (activeLibraryEntityId) {
    const activeEntity = Library.getEntity(activeLibraryEntityId);

    if (activeEntity) {
      const activeList = wrapper.querySelector(`[data-library-type-list="${activeEntity.type}"]`);
      const activeToggle = wrapper.querySelector(`[data-library-type-toggle="${activeEntity.type}"] span`);

      if (activeList) activeList.hidden = false;
      if (activeToggle) activeToggle.textContent = "▾";
    }
  }
}

function renderMyPracticeLayer(entity) {
  const myPractice = entity.myPractice || {};
  const entries = Object.entries(myPractice).filter(([, value]) => value);

  return `
    <section class="book-library-layer book-library-layer--my-practice">
      <h2>My Practice</h2>

      ${
        entries.length
          ? `
            <div class="book-library-fields">
              ${entries.map(([key, value]) => renderLibraryField(key, value)).join("")}
            </div>
          `
          : `
            <p class="book-placeholder">
              No personal practice notes have been added yet.
            </p>
          `
      }
    </section>
  `;
}

function renderCommunityLayer(entity) {
  const community = entity.community || {};
  const entries = Object.entries(community).filter(([, value]) => value);

  return `
    <section class="book-library-layer book-library-layer--community">
      <h2>Community</h2>

      ${
        entries.length
          ? `
            <div class="book-library-fields">
              ${entries.map(([key, value]) => renderLibraryField(key, value)).join("")}
            </div>
          `
          : `
            <p class="book-placeholder">
              No community information has been approved yet.
            </p>
          `
      }
    </section>
  `;
}

function renderLibraryEntity(entityId) {
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

  entryList.innerHTML = `
    <section class="book-reader-page book-library-entity-page">
      <header class="book-reader-header book-library-header">
        <p class="book-apothecary-meta">
          ${getTraditionalTypeLabel(entity.type)}
        </p>

        <h1>${formatLibraryEntityName(entity.name)}</h1>

        <p class="book-library-intro">
          ${escapeHtml(getLibraryEntityIntro(entity))}
        </p>

        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>

        ${
          tags.length
            ? `
              <div class="book-library-tags">
                ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
              </div>
            `
            : ""
        }
      </header>

      <div class="book-reader-body book-library-body">
        ${groupTraditionalFields(traditional)}
        ${renderMyPracticeLayer(entity)}
        ${renderCommunityLayer(entity)}
      </div>
    </section>
  `;

  renderTraditionalLibraryShelf();
}

document.addEventListener("click", async (event) => {
  const libraryEntityButton = event.target.closest("[data-library-entity-id]");
  const traditionalToggle = event.target.closest("[data-traditional-library-toggle]");
  const typeToggle = event.target.closest("[data-library-type-toggle]");

  if (libraryEntityButton) {
    renderLibraryEntity(libraryEntityButton.dataset.libraryEntityId);
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

/* =========================================================
   STARTUP
   ========================================================= */

updateMundaneModeUI();
updateAuthState();

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
