/* =========================================================
   BOOK OF SHADOWS
   File: altar/grimoire/grimoire.js
   ========================================================= */

const grimoireAuthNotice = document.querySelector("[data-grimoire-auth-notice]");
const entryStatus = document.querySelector("[data-entry-status]");
const entryList = document.querySelector("[data-entry-list]");
const grimoireEmpty = document.querySelector("[data-grimoire-empty]");
const grimoireHeading = document.querySelector("[data-grimoire-heading]");
const entrySearch = document.querySelector("[data-entry-search]");
const grimoireShelf = document.querySelector("[data-grimoire-toc]");
const bookPage = document.querySelector("[data-book-page]");
const editToggleButton = document.querySelector("[data-toggle-edit]");

let currentBook = null;
let sections = [];
let pages = [];
let currentPage = null;
let currentBlocks = [];
let activeSectionId = null;
let searchTerm = "";
let pageMode = "read";
let autosaveTimers = {};

function setStatus(message) {
  if (entryStatus) entryStatus.textContent = message || "";
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
    year: "long",
    month: "long",
    day: "numeric"
  });
}

function debounceSave(key, callback) {
  window.clearTimeout(autosaveTimers[key]);
  autosaveTimers[key] = window.setTimeout(callback, 650);
}

function updateStatus(message) {
  setStatus(message);

  window.clearTimeout(updateStatus.timeout);
  updateStatus.timeout = window.setTimeout(() => {
    setStatus("");
  }, 2200);
}

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
  activeSectionId = null;
  pageMode = "read";

  if (editToggleButton) editToggleButton.hidden = true;
  if (entryList) entryList.innerHTML = "";

  if (grimoireHeading) grimoireHeading.textContent = "Welcome";

  if (grimoireEmpty) {
    grimoireEmpty.hidden = false;
    grimoireEmpty.style.display = "";
  }

  renderShelf();
}

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
      await openPage(pages[0].id);
    } else {
      renderWelcomeState();
    }

    setStatus("");
  } catch (error) {
    console.error("Could not open grimoire:", error);
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

function renderShelf() {
  if (!grimoireShelf) return;

  const signedIn = Boolean(getUser());

  if (!signedIn) {
    grimoireShelf.innerHTML = `
      <p class="book-note">Sign in to open your book.</p>
    `;
    return;
  }

  const loosePages = pages.filter((page) => !page.section_id);

  grimoireShelf.innerHTML = `
    <div class="book-section-list">
      ${
        sections.length === 0 && loosePages.length === 0
          ? `<p class="book-note">Your book is blank. Begin with a section or page.</p>`
          : ""
      }

      ${sections
        .map((section) => {
          const sectionPages = pages.filter(
            (page) => page.section_id === section.id
          );

          return `
            <section class="book-toc-section">
              <button
                class="book-section-title ${
                  activeSectionId === section.id ? "is-active" : ""
                }"
                type="button"
                data-section-id="${section.id}">
                ${escapeHtml(section.title)}
              </button>

              <div class="book-section-pages">
                ${
                  sectionPages.length === 0
                    ? `<p class="book-section-empty">No pages yet.</p>`
                    : sectionPages.map(renderShelfPageButton).join("")
                }
              </div>
            </section>
          `;
        })
        .join("")}

      ${
        loosePages.length > 0
          ? `
            <section class="book-toc-section">
              <button class="book-section-title" type="button" data-section-id="">
                Loose Pages
              </button>

              <div class="book-section-pages">
                ${loosePages.map(renderShelfPageButton).join("")}
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
}

function renderShelfPageButton(page) {
  return `
    <button
      class="book-page-link ${
        currentPage && currentPage.id === page.id ? "is-active" : ""
      }"
      type="button"
      data-page-id="${page.id}">
      ${escapeHtml(page.title)}
    </button>
  `;
}

function renderWelcomeState() {
  currentPage = null;
  currentBlocks = [];
  pageMode = "read";

  if (editToggleButton) editToggleButton.hidden = true;
  if (entryList) entryList.innerHTML = "";
  if (grimoireHeading) grimoireHeading.textContent = "Welcome";

  if (grimoireEmpty) {
    grimoireEmpty.hidden = false;
    grimoireEmpty.style.display = "";
  }
}

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
      sort_order: sections.length
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
  updateStatus("Section added.");
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

  const { data, error } = await db
    .from("grimoire_pages")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      section_id: chosenSectionId,
      title: title.trim(),
      icon: "",
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

  await openPage(data.id, "edit");
  updateStatus("Page added.");
}

async function openPage(pageId, mode = "read") {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return;

  currentPage = page;
  activeSectionId = page.section_id || null;
  pageMode = mode;

  if (grimoireHeading) grimoireHeading.textContent = page.title;

  if (grimoireEmpty) {
    grimoireEmpty.hidden = true;
    grimoireEmpty.style.display = "none";
  }

  if (editToggleButton) {
    editToggleButton.hidden = false;
    editToggleButton.textContent = pageMode === "edit" ? "Done" : "✎ Edit";
  }

  await loadBlocks(page);

  renderShelf();
  renderPage();
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

  if (currentBlocks.length > 0) return;

  const { data: firstBlock, error: createError } = await db
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

  currentBlocks = [firstBlock];
}

function renderPage() {
  if (!entryList || !currentPage) return;

  if (pageMode === "edit") {
    renderEditor();
    return;
  }

  renderReader();
}

function renderReader() {
  entryList.innerHTML = `
    <section class="book-reader-page">
      <header class="book-reader-header">
        <h1>${escapeHtml(currentPage.title)}</h1>
        <p class="book-reader-date">${formatDate(currentPage.created_at)}</p>
        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>
      </header>

      <div class="book-reader-body">
        ${
          currentBlocks.every((block) => !String(block.content || "").trim() && block.block_type !== "divider")
            ? `<p class="book-placeholder">This page is waiting for your words.</p>`
            : currentBlocks.map(renderReadableBlock).join("")
        }
      </div>
    </section>
  `;
}

function renderReadableBlock(block) {
  if (block.block_type === "heading") {
    return `<h2>${escapeHtml(block.content || "Untitled")}</h2>`;
  }

  if (block.block_type === "quote") {
    return `<blockquote><p>${escapeHtml(block.content || "")}</p></blockquote>`;
  }

  if (block.block_type === "divider") {
    return `<div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>`;
  }

  return `<p>${escapeHtml(block.content || "")}</p>`;
}

function renderEditor() {
  entryList.innerHTML = `
    <section class="book-editor-page">
      <header class="book-editor-header">
        <label>
          Page Title
          <input
            type="text"
            value="${escapeHtml(currentPage.title)}"
            data-page-title-input
          />
        </label>

        <div class="book-editor-actions">
          <button class="button button--primary button--small" type="button" data-save-and-read>
            Save and Read
          </button>

          <button class="button button--small" type="button" data-return-page-to-ashes>
            Return to Ashes
          </button>
        </div>
      </header>

      <div class="book-editor-elements">
        ${currentBlocks.map(renderEditableBlock).join("")}
      </div>

      <div class="book-add-elements">
        <button type="button" data-add-block-type="text">+ Paragraph</button>
        <button type="button" data-add-block-type="heading">+ Heading</button>
        <button type="button" data-add-block-type="quote">+ Quote</button>
        <button type="button" data-add-block-type="divider">+ Divider</button>
      </div>
    </section>
  `;
}

function renderEditableBlock(block) {
  if (block.block_type === "heading") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        <label>
          Heading
          <input
            type="text"
            value="${escapeHtml(block.content)}"
            data-block-input
            data-block-id="${block.id}"
          />
        </label>

        <button type="button" data-delete-block="${block.id}">Remove</button>
      </section>
    `;
  }

  if (block.block_type === "quote") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        <label>
          Quote
          <textarea
            rows="4"
            data-block-input
            data-block-id="${block.id}"
          >${escapeHtml(block.content)}</textarea>
        </label>

        <button type="button" data-delete-block="${block.id}">Remove</button>
      </section>
    `;
  }

  if (block.block_type === "divider") {
    return `
      <section class="book-edit-element book-edit-element--divider" data-block-id="${block.id}">
        <p>Divider</p>
        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>
        <button type="button" data-delete-block="${block.id}">Remove</button>
      </section>
    `;
  }

  return `
    <section class="book-edit-element" data-block-id="${block.id}">
      <label>
        Paragraph
        <textarea
          rows="7"
          data-block-input
          data-block-id="${block.id}"
        >${escapeHtml(block.content)}</textarea>
      </label>

      <button type="button" data-delete-block="${block.id}">Remove</button>
    </section>
  `;
}

async function createBlock(type = "text") {
  const user = requireUser();
  if (!user || !currentBook || !currentPage) return;

  const defaultContent = type === "heading" ? "New Heading" : "";

  const { data, error } = await db
    .from("grimoire_blocks")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      page_id: currentPage.id,
      block_type: type,
      content: defaultContent,
      sort_order: currentBlocks.length
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks.push(data);
  pageMode = "edit";
  renderEditor();
  updateStatus("Element added.");
}

async function saveBlock(blockId, value) {
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
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.map((block) =>
    block.id === data.id ? data : block
  );

  updateStatus("Page saved.");
}

async function deleteBlock(blockId) {
  if (currentBlocks.length === 1) {
    updateStatus("A page needs at least one paragraph.");
    return;
  }

  const confirmed = window.confirm("Remove this element from the page?");
  if (!confirmed) return;

  const { error } = await db
    .from("grimoire_blocks")
    .delete()
    .eq("id", blockId);

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.filter((block) => block.id !== blockId);
  renderEditor();
  updateStatus("Element removed.");
}

async function saveCurrentPageTitle() {
  if (!currentPage) return;

  const titleInput = document.querySelector("[data-page-title-input]");
  if (!titleInput) return;

  const newTitle = titleInput.value.trim() || "Untitled Page";

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
    setStatus(error.message);
    return;
  }

  currentPage = data;

  pages = pages.map((page) => (page.id === data.id ? data : page));

  if (grimoireHeading) grimoireHeading.textContent = data.title;

  renderShelf();
  updateStatus("Title saved.");
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
    await openPage(pages[0].id);
  } else {
    renderWelcomeState();
  }

  updateStatus("Page returned to ashes.");
}

function applySearch() {
  if (!searchTerm.trim()) {
    if (currentPage) {
      renderPage();
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

  if (grimoireEmpty) {
    grimoireEmpty.hidden = true;
    grimoireEmpty.style.display = "none";
  }

  if (editToggleButton) editToggleButton.hidden = true;

  entryList.innerHTML = `
    <section class="book-search-results">
      <h2>Search Results</h2>

      ${
        results.length === 0
          ? `<p>No pages found.</p>`
          : results
              .map(
                (page) => `
                  <button type="button" data-page-id="${page.id}">
                    ${escapeHtml(page.title)}
                  </button>
                `
              )
              .join("")
      }
    </section>
  `;
}

if (entrySearch) {
  entrySearch.addEventListener("input", () => {
    searchTerm = entrySearch.value;
    applySearch();
  });
}

if (editToggleButton) {
  editToggleButton.addEventListener("click", () => {
    if (!currentPage) return;

    pageMode = pageMode === "read" ? "edit" : "read";
    editToggleButton.textContent = pageMode === "edit" ? "Done" : "✎ Edit";
    renderPage();
  });
}

document.addEventListener("click", (event) => {
  const createSectionButton = event.target.closest("[data-create-section]");
  const createPageButton = event.target.closest("[data-create-page]");
  const sectionButton = event.target.closest("[data-section-id]");
  const pageButton = event.target.closest("[data-page-id]");
  const addBlockButton = event.target.closest("[data-add-block-type]");
  const deleteBlockButton = event.target.closest("[data-delete-block]");
  const ashesButton = event.target.closest("[data-return-page-to-ashes]");
  const saveAndReadButton = event.target.closest("[data-save-and-read]");

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
    searchTerm = "";
    if (entrySearch) entrySearch.value = "";
    openPage(pageButton.dataset.pageId);
    return;
  }

  if (addBlockButton) {
    createBlock(addBlockButton.dataset.addBlockType);
    return;
  }

  if (deleteBlockButton) {
    deleteBlock(deleteBlockButton.dataset.deleteBlock);
    return;
  }

  if (ashesButton) {
    returnCurrentPageToAshes();
    return;
  }

  if (saveAndReadButton) {
    saveCurrentPageTitle();
    pageMode = "read";
    if (editToggleButton) editToggleButton.textContent = "✎ Edit";
    renderReader();
  }
});

document.addEventListener("input", (event) => {
  const blockInput = event.target.closest("[data-block-input]");
  const titleInput = event.target.closest("[data-page-title-input]");

  if (blockInput) {
    const blockId = blockInput.dataset.blockId;

    debounceSave(blockId, () => {
      saveBlock(blockId, blockInput.value);
    });
  }

  if (titleInput) {
    debounceSave("page-title", saveCurrentPageTitle);
  }
});

document.addEventListener("saltAuthChanged", updateAuthState);
document.addEventListener("saltAuthSuccess", updateAuthState);

updateAuthState();
