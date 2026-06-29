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

async function initGrimoire() {
  const user = requireUser();
  if (!user) return;

  try {
    setStatus("Opening your Book of Shadows...");

    await loadOrCreateBook(user);
    await loadSections();
    await loadPages();

    renderShelf();

    if (pages.length > 0) {
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
   STARTUP
   ========================================================= */

updateMundaneModeUI();
updateAuthState();

/* =========================================================
   ALTAR IMPORT
   ========================================================= */

window.addEventListener("load", () => {
  const handoff = localStorage.getItem(ALTAR_GRIMOIRE_HANDOFF_KEY);

  if (!handoff) return;

  try {
    const ritual = JSON.parse(handoff);

    openAltarImportModal(ritual);

  } catch (error) {
    console.error(error);
    localStorage.removeItem(ALTAR_GRIMOIRE_HANDOFF_KEY);
  }
});
