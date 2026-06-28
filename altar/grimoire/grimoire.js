/* =========================================================
   BOOK OF SHADOWS
   File: altar/grimoire/grimoire.js

   First working version:
   - Creates/loads one Book of Shadows per user
   - Lets users create sections
   - Lets users create pages inside sections
   - Opens pages
   - Saves page content as one text block
   - Auto-saves while typing
   ========================================================= */


/* =========================================================
   1. ELEMENTS
   ========================================================= */

const grimoireAuthNotice = document.querySelector("[data-grimoire-auth-notice]");
const newEntryButton = document.querySelector("[data-new-entry]");
const entryForm = document.querySelector("[data-entry-form]");
const closeEntryFormButton = document.querySelector("[data-close-entry-form]");
const entryStatus = document.querySelector("[data-entry-status]");
const entryList = document.querySelector("[data-entry-list]");
const grimoireEmpty = document.querySelector("[data-grimoire-empty]");
const grimoireHeading = document.querySelector("[data-grimoire-heading]");
const entrySearch = document.querySelector("[data-entry-search]");
const chapterButtons = document.querySelectorAll("[data-entry-filter]");
const grimoireShelf = document.querySelector(".grimoire-shelf");
const grimoireBook = document.querySelector(".grimoire-book");


/* =========================================================
   2. STATE
   ========================================================= */

let currentBook = null;
let sections = [];
let pages = [];
let currentPage = null;
let currentBlock = null;
let activeSectionId = null;
let searchTerm = "";
let autosaveTimer = null;


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

function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function debounceAutosave(callback) {
  window.clearTimeout(autosaveTimer);

  autosaveTimer = window.setTimeout(callback, 650);
}

function showWhisper(message) {
  if (typeof showAltarToast === "function") {
    showAltarToast(message);
    return;
  }

  setStatus(message);
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
  currentBlock = null;
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
   6. SHELF / TABLE OF CONTENTS
   ========================================================= */

function renderShelf() {
  if (!grimoireShelf) return;

  const signedIn = Boolean(getUser());

  if (!signedIn) {
    grimoireShelf.innerHTML = `
      <h2>Book</h2>
      <p class="grimoire-sidebar-note">
        Sign in to create sections and pages.
      </p>
    `;
    return;
  }

  const unsectionedPages = pages.filter((page) => !page.section_id);

  grimoireShelf.innerHTML = `
    <h2>Book</h2>

    <button class="grimoire-chapter" type="button" data-create-section>
      ✦ New Section
    </button>

    <button class="grimoire-chapter" type="button" data-create-page>
      📄 New Page
    </button>

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
  currentBlock = null;

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
      <div class="button-row grimoire-empty-actions">
        <button class="button button--primary" type="button" data-create-section>
          Create First Section
        </button>
        <button class="button" type="button" data-create-page>
          Create First Page
        </button>
      </div>
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
   9. OPEN AND RENDER PAGE
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

  await loadOrCreateMainBlock(page);
  renderPageEditor(page);
}

async function loadOrCreateMainBlock(page) {
  const user = requireUser();
  if (!user || !currentBook || !page) return;

  const { data: existingBlocks, error: loadError } = await db
    .from("grimoire_blocks")
    .select("*")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true })
    .limit(1);

  if (loadError) throw loadError;

  if (existingBlocks && existingBlocks.length > 0) {
    currentBlock = existingBlocks[0];
    return currentBlock;
  }

  const { data: newBlock, error: createError } = await db
    .from("grimoire_blocks")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      page_id: page.id,
      block_type: "text",
      content: "",
      sort_order: 0
    })
    .select()
    .single();

  if (createError) throw createError;

  currentBlock = newBlock;
  return currentBlock;
}

function renderPageEditor(page) {
  if (!entryList) return;

  const blockContent = currentBlock ? currentBlock.content || "" : "";

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

      <textarea
        class="grimoire-page-textarea"
        data-page-content
        placeholder="Begin writing..."
      >${escapeHtml(blockContent)}</textarea>

      <p class="grimoire-autosave-status" data-autosave-status>
        Page opened.
      </p>
    </article>
  `;
}


/* =========================================================
   10. SAVE PAGE CONTENT AND TITLE
   ========================================================= */

async function saveCurrentBlock() {
  const user = requireUser();
  if (!user || !currentBlock || !currentPage) return;

  const contentInput = document.querySelector("[data-page-content]");
  const autosaveStatus = document.querySelector("[data-autosave-status]");

  if (!contentInput) return;

  if (autosaveStatus) {
    autosaveStatus.textContent = "Saving...";
  }

  const { data, error } = await db
    .from("grimoire_blocks")
    .update({
      content: contentInput.value,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentBlock.id)
    .select()
    .single();

  if (error) {
    if (autosaveStatus) {
      autosaveStatus.textContent = error.message;
    }

    return;
  }

  currentBlock = data;

  if (autosaveStatus) {
    autosaveStatus.textContent = "Page saved.";
  }
}

async function saveCurrentPageTitle() {
  const user = requireUser();
  if (!user || !currentPage) return;

  const titleInput = document.querySelector("[data-page-title-input]");
  const autosaveStatus = document.querySelector("[data-autosave-status]");

  if (!titleInput) return;

  const newTitle = titleInput.value.trim() || "Untitled Page";

  if (autosaveStatus) {
    autosaveStatus.textContent = "Saving title...";
  }

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
    if (autosaveStatus) {
      autosaveStatus.textContent = error.message;
    }

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

  if (autosaveStatus) {
    autosaveStatus.textContent = "Title saved.";
  }
}


/* =========================================================
   11. RENAME AND DELETE
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
  currentBlock = null;

  renderShelf();

  if (pages.length > 0) {
    openPage(pages[0].id);
  } else {
    renderWelcomeState();
  }

  showWhisper("Page returned to ashes");
}


/* =========================================================
   12. SEARCH
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
   13. EVENT LISTENERS
   ========================================================= */

if (newEntryButton) {
  newEntryButton.addEventListener("click", () => {
    createPage();
  });
}

if (closeEntryFormButton && entryForm) {
  closeEntryFormButton.addEventListener("click", () => {
    entryForm.hidden = true;
  });
}

if (entrySearch) {
  entrySearch.addEventListener("input", () => {
    searchTerm = entrySearch.value;
    applySearch();
  });
}

chapterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    chapterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    const filter = button.dataset.entryFilter;

    if (filter === "all") {
      searchTerm = "";
      if (entrySearch) entrySearch.value = "";

      if (pages.length > 0) {
        openPage(pages[0].id);
      } else {
        renderWelcomeState();
      }
    }
  });
});

document.addEventListener("click", (event) => {
  const createSectionButton = event.target.closest("[data-create-section]");
  const createPageButton = event.target.closest("[data-create-page]");
  const sectionButton = event.target.closest("[data-section-id]");
  const pageButton = event.target.closest("[data-page-id]");
  const renameButton = event.target.closest("[data-rename-page]");
  const ashesButton = event.target.closest("[data-return-page-to-ashes]");

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
  }
});

document.addEventListener("input", (event) => {
  const contentInput = event.target.closest("[data-page-content]");
  const titleInput = event.target.closest("[data-page-title-input]");
  const autosaveStatus = document.querySelector("[data-autosave-status]");

  if (contentInput) {
    if (autosaveStatus) {
      autosaveStatus.textContent = "Unsaved changes...";
    }

    debounceAutosave(saveCurrentBlock);
  }

  if (titleInput) {
    if (autosaveStatus) {
      autosaveStatus.textContent = "Unsaved title...";
    }

    debounceAutosave(saveCurrentPageTitle);
  }
});

document.addEventListener("saltAuthChanged", () => {
  updateGrimoireAuthState();
});

document.addEventListener("saltAuthSuccess", () => {
  updateGrimoireAuthState();
});


/* =========================================================
   14. INIT
   ========================================================= */

updateGrimoireAuthState();
