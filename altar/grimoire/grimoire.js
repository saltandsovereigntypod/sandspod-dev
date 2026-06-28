/* =========================================================
   BOOK OF SHADOWS
   File: altar/grimoire/grimoire.js

   Stage 1 block editor:
   - Creates/loads one Book of Shadows per user
   - Lets users create sections
   - Lets users create pages inside sections
   - Opens pages
   - Supports Text, Heading, and Divider blocks
   - Auto-saves page titles and block content
   ========================================================= */


/* =========================================================
   1. ELEMENTS
   ========================================================= */

const grimoireAuthNotice = document.querySelector("[data-grimoire-auth-notice]");
const entryStatus = document.querySelector("[data-entry-status]");
const entryList = document.querySelector("[data-entry-list]");
const grimoireEmpty = document.querySelector("[data-grimoire-empty]");
const grimoireHeading = document.querySelector("[data-grimoire-heading]");
const entrySearch = document.querySelector("[data-entry-search]");
const grimoireShelf = document.querySelector("[data-grimoire-toc]");


/* =========================================================
   2. STATE
   ========================================================= */

let currentBook = null;
let sections = [];
let pages = [];
let currentPage = null;
let currentBlocks = [];
let activeSectionId = null;
let searchTerm = "";
let autosaveTimers = {};


/* =========================================================
   3. SMALL HELPERS
   ========================================================= */

function setStatus(message) {
  if (entryStatus) {
    entryStatus.textContent = message || "";
  }
}

function getUser() {
  return typeof currentUser !== "undefined" ? currentUser : null;
}

function requireUser() {
  const user = getUser();

  if (!user) {
    setStatus("Open your grimoire before making changes.");
    return null;
  }

  return user;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function debounceBlockSave(key, callback) {
  window.clearTimeout(autosaveTimers[key]);

  autosaveTimers[key] = window.setTimeout(callback, 650);
}

function showWhisper(message) {
  setStatus(message);

  window.clearTimeout(showWhisper.timeout);

  showWhisper.timeout = window.setTimeout(() => {
    setStatus("");
  }, 2200);
}

function updateAutosaveStatus(message) {
  const autosaveStatus = document.querySelector("[data-autosave-status]");

  if (autosaveStatus) {
    autosaveStatus.textContent = message;
  }
}


/* =========================================================
   4. AUTH UI
   ========================================================= */

function updateGrimoireAuthState() {
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
  activeSectionId = null;

  if (grimoireHeading) {
    grimoireHeading.textContent = "Your Book Is Waiting";
  }

  if (entryList) {
    entryList.innerHTML = "";
  }

  if (grimoireEmpty) {
    grimoireEmpty.hidden = false;
    grimoireEmpty.innerHTML = `
      <p class="grimoire-empty-symbol">☽ ✦ ☾</p>
      <h3>Open your grimoire.</h3>
      <p>
        Sign in or create an account to begin building your personal Book of Shadows.
      </p>
    `;
  }

  renderShelf();
}


/* =========================================================
   5. BOOK CREATION AND LOADING
   ========================================================= */

async function initGrimoire() {
  const user = requireUser();
  if (!user) return;

  setStatus("Opening your Book of Shadows...");

  try {
    await loadOrCreateBook(user);
    await loadSections();
    await loadPages();

    renderShelf();

    if (pages.length > 0) {
      openPage(pages[0].id);
    } else {
      renderWelcomeState();
    }

    setStatus("");
  } catch (error) {
    console.error("Could not initialize grimoire:", error);
    setStatus(error.message || "The grimoire could not be opened.");
  }
}

async function loadOrCreateBook(user) {
  const { data: existingBooks, error: bookError } = await db
    .from("grimoire_books")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (bookError) throw bookError;

  if (existingBooks && existingBooks.length > 0) {
    currentBook = existingBooks[0];
    return currentBook;
  }

  const { data: newBook, error: createError } = await db
    .from("grimoire_books")
    .insert({
      user_id: user.id,
      title: "Book of Shadows"
    })
    .select()
    .single();

  if (createError) throw createError;

  currentBook = newBook;
  return currentBook;
}

async function loadSections() {
  if (!currentBook) return;

  const { data, error } = await db
    .from("grimoire_sections")
    .select("*")
    .eq("book_id", currentBook.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  sections = data || [];
}

async function loadPages() {
  if (!currentBook) return;

  const { data, error } = await db
    .from("grimoire_pages")
    .select("*")
    .eq("book_id", currentBook.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  pages = data || [];
}


/* =========================================================
   6. TABLE OF CONTENTS
   ========================================================= */

function renderShelf() {
  if (!grimoireShelf) return;

  const signedIn = Boolean(getUser());

  if (!signedIn) {
    grimoireShelf.innerHTML = `
      <p class="grimoire-sidebar-note">
        Sign in to create sections and pages.
      </p>
    `;
    return;
  }

  const unsectionedPages = pages.filter((page) => !page.section_id);

  grimoireShelf.innerHTML = `
    <div class="grimoire-section-list">
      ${
        sections.length === 0 && unsectionedPages.length === 0
          ? `<p class="grimoire-sidebar-note">Your book is blank. Begin with a section or page.</p>`
          : ""
      }

      ${sections
        .map((section) => {
          const sectionPages = pages.filter(
            (page) => page.section_id === section.id
          );

          return `
            <div class="grimoire-section-group">
              <button
                class="grimoire-section-title ${
                  activeSectionId === section.id ? "is-active" : ""
                }"
                type="button"
                data-section-id="${section.id}">
                <span>▾ ${escapeHtml(section.title)}</span>
                <small>${sectionPages.length}</small>
              </button>

              <div class="grimoire-section-pages">
                ${
                  sectionPages.length === 0
                    ? `<p class="grimoire-section-empty">No pages yet.</p>`
                    : sectionPages
                        .map((page) => renderShelfPageButton(page))
                        .join("")
                }
              </div>
            </div>
          `;
        })
        .join("")}

      ${
        unsectionedPages.length > 0
          ? `
            <div class="grimoire-section-group">
              <button class="grimoire-section-title" type="button" data-section-id="">
                <span>▾ Loose Pages</span>
                <small>${unsectionedPages.length}</small>
              </button>

              <div class="grimoire-section-pages">
                ${unsectionedPages
                  .map((page) => renderShelfPageButton(page))
                  .join("")}
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderShelfPageButton(page) {
  return `
    <button
      class="grimoire-page-link ${
        currentPage && currentPage.id === page.id ? "is-active" : ""
      }"
      type="button"
      data-page-id="${page.id}">
      <span>${escapeHtml(page.icon || "📄")}</span>
      ${escapeHtml(page.title)}
    </button>
  `;
}


/* =========================================================
   7. WELCOME / EMPTY STATES
   ========================================================= */

function renderWelcomeState() {
  currentPage = null;
  currentBlocks = [];

  if (grimoireHeading) {
    grimoireHeading.textContent = "Welcome";
  }

  if (entryList) {
    entryList.innerHTML = "";
  }

  if (grimoireEmpty) {
    grimoireEmpty.hidden = false;
    grimoireEmpty.innerHTML = `
      <p class="grimoire-empty-symbol">☽ ✦ ☾</p>
      <h3>Welcome to your Book of Shadows.</h3>
      <p>
        This book begins blank. There is no required structure, no correct
        order, and no prescribed path. Create sections, add pages, and let
        your practice shape the archive.
      </p>
    `;
  }
}

function renderNoResultsState() {
  if (!entryList || !grimoireEmpty) return;

  entryList.innerHTML = "";
  grimoireEmpty.hidden = false;
  grimoireEmpty.innerHTML = `
    <p class="grimoire-empty-symbol">✦</p>
    <h3>No pages found.</h3>
    <p>
      Try a different search, or create a new page for what you are looking for.
    </p>
  `;
}


/* =========================================================
   8. CREATE SECTIONS AND PAGES
   ========================================================= */

async function createSection() {
  const user = requireUser();
  if (!user || !currentBook) return;

  const title = window.prompt("Name this section:", "Herbs");

  if (!title || !title.trim()) return;

  const sortOrder = sections.length;

  const { data, error } = await db
    .from("grimoire_sections")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      title: title.trim(),
      sort_order: sortOrder
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
  showWhisper("Section created");
}

async function createPage(sectionId = activeSectionId) {
  const user = requireUser();
  if (!user || !currentBook) return;

  let chosenSectionId = sectionId || null;

  if (!chosenSectionId && sections.length > 0) {
    const useLoosePage = window.confirm(
      "Create this as a loose page? Press Cancel to choose a section."
    );

    if (!useLoosePage) {
      const sectionNames = sections
        .map((section, index) => `${index + 1}. ${section.title}`)
        .join("\n");

      const sectionChoice = window.prompt(
        `Choose a section number:\n\n${sectionNames}`,
        "1"
      );

      const chosenIndex = Number(sectionChoice) - 1;

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

  const icon = window.prompt("Choose an icon for this page:", "📄") || "📄";

  const { data, error } = await db
    .from("grimoire_pages")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      section_id: chosenSectionId,
      title: title.trim(),
      icon: icon.trim() || "📄",
      sort_order: sectionPageCount
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  pages.push(data);
  activeSectionId = chosenSectionId;
  renderShelf();
  openPage(data.id);
  showWhisper("Page created");
}


/* =========================================================
   9. OPEN PAGE AND LOAD BLOCKS
   ========================================================= */

async function openPage(pageId) {
  const page = pages.find((item) => item.id === pageId);

  if (!page) return;

  currentPage = page;
  activeSectionId = page.section_id || null;

  if (grimoireHeading) {
    grimoireHeading.textContent = page.title;
  }

  if (grimoireEmpty) {
    grimoireEmpty.hidden = true;
  }

  renderShelf();

  await loadBlocks(page);
  renderPageEditor(page);
}

async function loadBlocks(page) {
  const user = requireUser();
  if (!user || !currentBook || !page) return;

  const { data, error } = await db
    .from("grimoire_blocks")
    .select("*")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  currentBlocks = data || [];

  if (currentBlocks.length === 0) {
    await createBlock("text", "", 0, false);
  }
}


/* =========================================================
   10. RENDER PAGE EDITOR
   ========================================================= */

function renderPageEditor(page) {
  if (!entryList) return;

  entryList.innerHTML = `
    <article class="grimoire-page-editor">
      <header class="grimoire-page-editor-header">
        <div>
          <p class="eyebrow">Page</p>

          <div class="grimoire-page-title-row">
            <span class="grimoire-page-icon">${escapeHtml(page.icon || "📄")}</span>

            <input
              class="grimoire-page-title-input"
              type="text"
              value="${escapeHtml(page.title)}"
              data-page-title-input
              aria-label="Page title"
            />
          </div>

          <p class="grimoire-page-meta">
            Created ${formatDate(page.created_at)}
          </p>
        </div>

        <div class="grimoire-entry-actions">
          <button type="button" data-rename-page>Rename</button>
          <button type="button" data-return-page-to-ashes>Return to Ashes</button>
        </div>
      </header>

      <div class="grimoire-block-list" data-block-list>
        ${currentBlocks.map(renderBlock).join("")}
      </div>

      <div class="grimoire-add-block-wrap">
        <button class="grimoire-add-block-button" type="button" data-open-block-menu>
          ✦ Add Block
        </button>

        <div class="grimoire-block-menu" data-block-menu hidden>
          <p class="eyebrow">Choose Block</p>

          <button type="button" data-add-block-type="text">
            📝 Text
          </button>

          <button type="button" data-add-block-type="heading">
            # Heading
          </button>

          <button type="button" data-add-block-type="divider">
            ─ Divider
          </button>
        </div>
      </div>

      <p class="grimoire-autosave-status" data-autosave-status>
        Page opened.
      </p>
    </article>
  `;
}

function renderBlock(block) {
  if (block.block_type === "heading") {
    return `
      <section class="grimoire-block grimoire-block--heading" data-block-id="${block.id}">
        <input
          class="grimoire-block-heading-input"
          type="text"
          value="${escapeHtml(block.content)}"
          placeholder="Heading"
          data-block-input
          data-block-id="${block.id}"
          aria-label="Heading block"
        />

        <button class="grimoire-block-delete" type="button" data-delete-block="${block.id}" aria-label="Delete block">
          ×
        </button>
      </section>
    `;
  }

  if (block.block_type === "divider") {
    return `
      <section class="grimoire-block grimoire-block--divider" data-block-id="${block.id}">
        <div class="grimoire-divider-symbol">☽ ✦ ☾</div>

        <button class="grimoire-block-delete" type="button" data-delete-block="${block.id}" aria-label="Delete block">
          ×
        </button>
      </section>
    `;
  }

  return `
    <section class="grimoire-block grimoire-block--text" data-block-id="${block.id}">
      <textarea
        class="grimoire-block-textarea"
        placeholder="Begin writing..."
        data-block-input
        data-block-id="${block.id}"
        aria-label="Text block"
      >${escapeHtml(block.content)}</textarea>

      <button class="grimoire-block-delete" type="button" data-delete-block="${block.id}" aria-label="Delete block">
        ×
      </button>
    </section>
  `;
}


/* =========================================================
   11. CREATE, SAVE, AND DELETE BLOCKS
   ========================================================= */

async function createBlock(type = "text", content = "", sortOrder = currentBlocks.length, shouldRender = true) {
  const user = requireUser();
  if (!user || !currentBook || !currentPage) return;

  const { data, error } = await db
    .from("grimoire_blocks")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      page_id: currentPage.id,
      block_type: type,
      content,
      sort_order: sortOrder
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks.push(data);

  if (shouldRender) {
    renderPageEditor(currentPage);
    focusBlock(data.id);
    showWhisper("Block added");
  }

  return data;
}

function focusBlock(blockId) {
  window.setTimeout(() => {
    const input = document.querySelector(`[data-block-input][data-block-id="${blockId}"]`);

    if (input) {
      input.focus();
    }
  }, 50);
}

async function saveBlock(blockId, value) {
  const block = currentBlocks.find((item) => item.id === blockId);
  if (!block) return;

  updateAutosaveStatus("Saving...");

  const { data, error } = await db
    .from("grimoire_blocks")
    .update({
      content: value,
      updated_at: new Date().toISOString()
    })
    .eq("id", blockId)
    .select()
    .single();

  if (error) {
    updateAutosaveStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.map((item) => {
    if (item.id === data.id) return data;
    return item;
  });

  updateAutosaveStatus("Page saved.");
}

async function deleteBlock(blockId) {
  const block = currentBlocks.find((item) => item.id === blockId);
  if (!block) return;

  if (currentBlocks.length === 1) {
    showWhisper("A page needs at least one block");
    return;
  }

  const confirmed = window.confirm("Return this block to ashes?");

  if (!confirmed) return;

  const { error } = await db
    .from("grimoire_blocks")
    .delete()
    .eq("id", blockId);

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.filter((item) => item.id !== blockId);
  renderPageEditor(currentPage);
  showWhisper("Block returned to ashes");
}


/* =========================================================
   12. SAVE PAGE TITLE
   ========================================================= */

async function saveCurrentPageTitle() {
  const user = requireUser();
  if (!user || !currentPage) return;

  const titleInput = document.querySelector("[data-page-title-input]");

  if (!titleInput) return;

  const newTitle = titleInput.value.trim() || "Untitled Page";

  updateAutosaveStatus("Saving title...");

  const { data, error } = await db
    .from("grimoire_pages")
    .update({
      title: newTitle,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentPage.id)
    .select()
    .single();

  if (error) {
    updateAutosaveStatus(error.message);
    return;
  }

  currentPage = data;

  pages = pages.map((page) => {
    if (page.id === data.id) return data;
    return page;
  });

  if (grimoireHeading) {
    grimoireHeading.textContent = data.title;
  }

  renderShelf();
  updateAutosaveStatus("Title saved.");
}


/* =========================================================
   13. RENAME AND DELETE PAGE
   ========================================================= */

async function renameCurrentPage() {
  if (!currentPage) return;

  const newTitle = window.prompt("Rename this page:", currentPage.title);

  if (!newTitle || !newTitle.trim()) return;

  const titleInput = document.querySelector("[data-page-title-input]");

  if (titleInput) {
    titleInput.value = newTitle.trim();
  }

  await saveCurrentPageTitle();
}

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

  renderShelf();

  if (pages.length > 0) {
    openPage(pages[0].id);
  } else {
    renderWelcomeState();
  }

  showWhisper("Page returned to ashes");
}


/* =========================================================
   14. SEARCH
   ========================================================= */

function applySearch() {
  if (!searchTerm.trim()) {
    if (currentPage) {
      renderPageEditor(currentPage);
    } else if (pages.length > 0) {
      openPage(pages[0].id);
    } else {
      renderWelcomeState();
    }

    return;
  }

  const results = pages.filter((page) =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (grimoireHeading) {
    grimoireHeading.textContent = `Search: ${searchTerm}`;
  }

  if (results.length === 0) {
    renderNoResultsState();
    return;
  }

  if (grimoireEmpty) {
    grimoireEmpty.hidden = true;
  }

  if (entryList) {
    entryList.innerHTML = results
      .map(
        (page) => `
          <article class="grimoire-entry-card">
            <div class="grimoire-entry-card-header">
              <div>
                <h3>${escapeHtml(page.icon || "📄")} ${escapeHtml(page.title)}</h3>
                <p class="grimoire-entry-content">
                  Created ${formatDate(page.created_at)}
                </p>
              </div>

              <div class="grimoire-entry-actions">
                <button type="button" data-page-id="${page.id}">
                  Open
                </button>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }
}


/* =========================================================
   15. EVENT LISTENERS
   ========================================================= */

if (entrySearch) {
  entrySearch.addEventListener("input", () => {
    searchTerm = entrySearch.value;
    applySearch();
  });
}

document.addEventListener("click", (event) => {
  const createSectionButton = event.target.closest("[data-create-section]");
  const createPageButton = event.target.closest("[data-create-page]");
  const sectionButton = event.target.closest("[data-section-id]");
  const pageButton = event.target.closest("[data-page-id]");
  const renameButton = event.target.closest("[data-rename-page]");
  const ashesButton = event.target.closest("[data-return-page-to-ashes]");
  const openBlockMenuButton = event.target.closest("[data-open-block-menu]");
  const addBlockButton = event.target.closest("[data-add-block-type]");
  const deleteBlockButton = event.target.closest("[data-delete-block]");

  if (createSectionButton) {
    createSection();
    return;
  }

  if (createPageButton) {
    createPage();
    return;
  }

  if (sectionButton && !pageButton) {
    activeSectionId = sectionButton.dataset.sectionId || null;
    renderShelf();
    return;
  }

  if (pageButton) {
    openPage(pageButton.dataset.pageId);
    return;
  }

  if (renameButton) {
    renameCurrentPage();
    return;
  }

  if (ashesButton) {
    returnCurrentPageToAshes();
    return;
  }

  if (openBlockMenuButton) {
    const menu = document.querySelector("[data-block-menu]");

    if (menu) {
      menu.hidden = !menu.hidden;
    }

    return;
  }

  if (addBlockButton) {
    const type = addBlockButton.dataset.addBlockType;
    createBlock(type);
    return;
  }

  if (deleteBlockButton) {
    deleteBlock(deleteBlockButton.dataset.deleteBlock);
  }
});

document.addEventListener("input", (event) => {
  const blockInput = event.target.closest("[data-block-input]");
  const titleInput = event.target.closest("[data-page-title-input]");

  if (blockInput) {
    const blockId = blockInput.dataset.blockId;

    updateAutosaveStatus("Unsaved changes...");

    debounceBlockSave(blockId, () => {
      saveBlock(blockId, blockInput.value);
    });
  }

  if (titleInput) {
    updateAutosaveStatus("Unsaved title...");

    debounceBlockSave("page-title", saveCurrentPageTitle);
  }
});

document.addEventListener("saltAuthChanged", () => {
  updateGrimoireAuthState();
});

document.addEventListener("saltAuthSuccess", () => {
  updateGrimoireAuthState();
});


/* =========================================================
   16. INIT
   ========================================================= */

updateGrimoireAuthState();
