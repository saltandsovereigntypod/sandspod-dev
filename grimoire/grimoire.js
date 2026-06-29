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
const editToggleButton = document.querySelector("[data-toggle-edit]");
const mundaneToggle = document.querySelector("[data-mundane-toggle]");

let currentBook = null;
let sections = [];
let pages = [];
let currentPage = null;
let currentBlocks = [];
let pageLinks = [];
let activeSectionId = null;
let pageMode = "read";
let searchTerm = "";
let autosaveTimers = {};
let activeRichEditor = null;
let mundaneMode = localStorage.getItem("saltMundaneMode") === "true";

const ELEMENT_TYPES = [
  { type: "text", label: "Paragraph", group: "Writing" },
  { type: "heading", label: "Heading", group: "Writing" },
  { type: "callout", label: "Note / Quote", group: "Writing" },
  { type: "divider", label: "Divider", group: "Structure" },
  { type: "checklist", label: "Checklist", group: "Structure" },
  { type: "bulleted_list", label: "Bulleted List", group: "Structure" },
  { type: "numbered_list", label: "Numbered List", group: "Structure" },
  { type: "ingredient_list", label: "Ingredient List", group: "Magical" },
  { type: "correspondence", label: "Correspondence", group: "Magical" },
  { type: "image", label: "Image", group: "Media & Links" },
  { type: "page_link", label: "Page Link", group: "Media & Links" }
];

const PAGE_TEMPLATES = {
  blank: {
    label: "Blank Page",
    blocks: [{ type: "text", content: "" }]
  },
  herb: {
    label: "Herb Entry",
    blocks: [
      { type: "heading", content: "Correspondences" },
      { type: "correspondence", content: "Planet:\nElement:\nDeities:\nMagical uses:" },
      { type: "heading", content: "Traditional Uses" },
      { type: "text", content: "" },
      { type: "heading", content: "Warnings" },
      { type: "callout", content: "Add any safety notes, contraindications, or personal cautions here." },
      { type: "heading", content: "Personal Notes" },
      { type: "text", content: "" }
    ]
  },
  crystal: {
    label: "Crystal Entry",
    blocks: [
      { type: "heading", content: "Correspondences" },
      { type: "correspondence", content: "Element:\nChakra:\nPlanet:\nMagical uses:" },
      { type: "heading", content: "How I Work With It" },
      { type: "text", content: "" },
      { type: "heading", content: "Personal Notes" },
      { type: "text", content: "" }
    ]
  },
  deity: {
    label: "Deity Entry",
    blocks: [
      { type: "heading", content: "Titles and Epithets" },
      { type: "text", content: "" },
      { type: "heading", content: "Offerings" },
      { type: "ingredient_list", content: "" },
      { type: "heading", content: "Signs and Symbols" },
      { type: "bulleted_list", content: "" },
      { type: "heading", content: "Personal Relationship" },
      { type: "text", content: "" }
    ]
  },
  dream: {
    label: "Dream Journal",
    blocks: [
      { type: "heading", content: "Dream Notes" },
      { type: "text", content: "" },
      { type: "heading", content: "Symbols" },
      { type: "bulleted_list", content: "" },
      { type: "heading", content: "Interpretation" },
      { type: "text", content: "" }
    ]
  },
  ritual: {
    label: "Ritual",
    blocks: [
      { type: "heading", content: "Purpose" },
      { type: "text", content: "" },
      { type: "heading", content: "Materials" },
      { type: "ingredient_list", content: "" },
      { type: "heading", content: "Ritual Steps" },
      { type: "numbered_list", content: "" },
      { type: "heading", content: "Reflections" },
      { type: "text", content: "" }
    ]
  },
  tarot: {
    label: "Tarot Reading",
    blocks: [
      { type: "heading", content: "Question" },
      { type: "text", content: "" },
      { type: "heading", content: "Cards Pulled" },
      { type: "bulleted_list", content: "" },
      { type: "heading", content: "Interpretation" },
      { type: "text", content: "" }
    ]
  },
  moon: {
    label: "Moon Journal",
    blocks: [
      { type: "heading", content: "Moon Phase" },
      { type: "text", content: "" },
      { type: "heading", content: "Energy" },
      { type: "text", content: "" },
      { type: "heading", content: "Intentions or Release" },
      { type: "text", content: "" }
    ]
  }
};

/* =========================================================
   HELPERS
   ========================================================= */

function setStatus(message) {
  if (entryStatus) entryStatus.textContent = message || "";
}

function flashStatus(message) {
  setStatus(message);

  window.clearTimeout(flashStatus.timeout);
  flashStatus.timeout = window.setTimeout(() => {
    setStatus("");
  }, 2200);
}

function getUser() {
  return typeof currentUser !== "undefined" ? currentUser : null;
}

function requireUser() {
  const user = getUser();

  if (!user) {
    setStatus("Sign in to open your grimoire.");
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

function sanitizeHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");

  const allowedTags = ["B", "STRONG", "I", "EM", "U", "BR", "A", "SPAN"];
  const allowedAttrs = ["href", "target", "rel", "class"];

  template.content.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.includes(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    [...node.attributes].forEach((attr) => {
      if (!allowedAttrs.includes(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });

    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";

      if (!href.startsWith("#") && !href.startsWith("http")) {
        node.removeAttribute("href");
      }

      node.setAttribute("rel", "noopener");
    }
  });

  return template.innerHTML;
}

function richText(value) {
  const clean = sanitizeHtml(value);
  return clean.trim() ? clean : "";
}

function plainToHtml(value) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function debounceSave(key, callback) {
  window.clearTimeout(autosaveTimers[key]);
  autosaveTimers[key] = window.setTimeout(callback, 700);
}

function hideEmptyState() {
  if (!grimoireEmpty) return;

  grimoireEmpty.hidden = true;
  grimoireEmpty.style.display = "none";
}

function showEmptyState() {
  if (!grimoireEmpty) return;

  grimoireEmpty.hidden = false;
  grimoireEmpty.style.display = "";
}

function updateEditButton() {
  if (!editToggleButton) return;

  if (!currentPage) {
    editToggleButton.hidden = true;
    return;
  }

  editToggleButton.hidden = false;
  editToggleButton.textContent = pageMode === "edit" ? "Done" : "✎ Edit";
}

function getBlockMetadata(block) {
  if (!block || !block.metadata) return {};

  if (typeof block.metadata === "string") {
    try {
      return JSON.parse(block.metadata);
    } catch {
      return {};
    }
  }

  return block.metadata || {};
}

function blockContent(block) {
  if (!block) return "";
  return block.rich_content?.html || block.content || "";
}

/* =========================================================
   AUTH
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
   LOAD
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
      metadata: {},
      rich_content: null,
      sort_order: 0
    })
    .select()
    .single();

  if (createError) throw createError;

  currentBlocks = [firstBlock];
}

async function loadPageLinks(page) {
  const user = requireUser();
  if (!user || !currentBook || !page) return;

  const { data, error } = await db
    .from("grimoire_page_links")
    .select("*")
    .eq("source_page_id", page.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Page links could not be loaded:", error.message);
    pageLinks = [];
    return;
  }

  pageLinks = data || [];
}

/* =========================================================
   TABLE OF CONTENTS
   ========================================================= */

function renderShelf() {
  if (!grimoireShelf) return;

  if (!getUser()) {
    grimoireShelf.innerHTML = `<p class="book-note">Sign in to open your book.</p>`;
    return;
  }

  const sortedSections = [...sections].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const loosePages = pages
    .filter((page) => !page.section_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  grimoireShelf.innerHTML = `
    <div class="book-section-list">
      ${
        sortedSections.length === 0 && loosePages.length === 0
          ? `<p class="book-note">Your book is blank. Begin with a section or page.</p>`
          : ""
      }

      ${sortedSections.map(renderSection).join("")}

      ${
        loosePages.length > 0
          ? `
            <section class="book-toc-section">
              <button class="book-section-title" type="button" data-section-id="">
                <span>Loose Pages</span>
              </button>

              <div class="book-section-pages">
                ${loosePages
                  .map((page, index) => renderShelfPageButton(page, loosePages, index))
                  .join("")}
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
}

function renderSection(section) {
  const sortedSections = [...sections].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const sectionPages = pages
    .filter((page) => page.section_id === section.id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const isCollapsed = section.is_collapsed === true;
  const sectionIndex = sortedSections.findIndex((item) => item.id === section.id);

  return `
    <section class="book-toc-section">
      <div class="book-section-row">
        <button
          class="book-section-title ${activeSectionId === section.id ? "is-active" : ""}"
          type="button"
          data-toggle-section="${section.id}">
          <span>${isCollapsed ? "▸" : "▾"} ${escapeHtml(section.title)}</span>
        </button>

        <div class="book-toc-move-controls">
          <button
            type="button"
            data-move-section-up="${section.id}"
            ${sectionIndex === 0 ? "disabled" : ""}>
            ↑
          </button>

          <button
            type="button"
            data-move-section-down="${section.id}"
            ${sectionIndex === sortedSections.length - 1 ? "disabled" : ""}>
            ↓
          </button>
        </div>
      </div>

      <div class="book-section-pages" ${isCollapsed ? "hidden" : ""}>
        ${
          sectionPages.length === 0
            ? `<p class="book-section-empty">No pages yet.</p>`
            : sectionPages
                .map((page, index) => renderShelfPageButton(page, sectionPages, index))
                .join("")
        }
      </div>
    </section>
  `;
}

function renderShelfPageButton(page, pageGroup = [], index = 0) {
  return `
    <div class="book-page-row">
      <button
        class="book-page-link ${currentPage && currentPage.id === page.id ? "is-active" : ""}"
        type="button"
        data-page-id="${page.id}">
        ${escapeHtml(page.title)}
      </button>

      <div class="book-toc-move-controls">
        <button
          type="button"
          data-move-page-up="${page.id}"
          ${index === 0 ? "disabled" : ""}>
          ↑
        </button>

        <button
          type="button"
          data-move-page-down="${page.id}"
          ${index === pageGroup.length - 1 ? "disabled" : ""}>
          ↓
        </button>
      </div>
    </div>
  `;
}

async function toggleSection(sectionId) {
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return;

  const nextValue = !section.is_collapsed;

  section.is_collapsed = nextValue;
  renderShelf();

  const { error } = await db
    .from("grimoire_sections")
    .update({ is_collapsed: nextValue })
    .eq("id", sectionId);

  if (error) {
    section.is_collapsed = !nextValue;
    renderShelf();
    setStatus(error.message);
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
          <p class="book-placeholder">This page could not be opened: ${escapeHtml(error.message)}</p>
        </section>
      `;
    }
  }
}

function renderPage() {
  if (!entryList || !currentPage) return;

  hideEmptyState();
  updateEditButton();

  if (pageMode === "edit") {
    renderEditor();
  } else {
    renderReader();
  }
}

/* =========================================================
   READER
   ========================================================= */

function renderReader() {
  const hasContent = currentBlocks.some((block) => {
    if (block.block_type === "divider") return true;
    return String(blockContent(block) || "").trim();
  });

  entryList.innerHTML = `
    <section class="book-reader-page">
      <header class="book-reader-header">
        <h1>${escapeHtml(getDisplayPageTitle())}</h1>
        <p class="book-reader-date">${formatDate(currentPage.created_at)}</p>
        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>
      </header>

      <div class="book-reader-body">
        ${
          hasContent
            ? currentBlocks.map(renderReadableElement).join("")
            : `<p class="book-placeholder">This page is waiting for your words.</p>`
        }

        ${renderReadablePageLinks()}
      </div>
    </section>
  `;
}

function renderReadableElement(block) {
  const type = block.block_type;
  const content = blockContent(block);
  const metadata = getBlockMetadata(block);

  if (type === "heading") {
    return `<h2>${richText(content) || "Untitled"}</h2>`;
  }

  if (type === "quote") {
    return `<blockquote><p>${richText(content)}</p></blockquote>`;
  }

  if (type === "callout") {
    return `
      <aside class="book-callout">
        <p>${richText(content) || "Callout"}</p>
      </aside>
    `;
  }

  if (type === "divider") {
    return `<div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>`;
  }

  if (type === "checklist") {
    return renderReadableList(content, "checklist");
  }

  if (type === "bulleted_list") {
    return renderReadableList(content, "ul");
  }

  if (type === "numbered_list") {
    return renderReadableList(content, "ol");
  }

  if (type === "ingredient_list") {
    return `
      <div class="book-ingredient-list">
        <h3>Ingredients</h3>
        ${renderReadableList(content, "ul")}
      </div>
    `;
  }

  if (type === "correspondence") {
    return `
      <div class="book-correspondence">
        ${plainToHtml(content)}
      </div>
    `;
  }

  if (type === "image") {
    const imageUrl = metadata.url || content;

    if (!imageUrl) return "";

    return `
      <figure class="book-image">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(metadata.alt || "")}" />
        ${metadata.caption ? `<figcaption>${escapeHtml(metadata.caption)}</figcaption>` : ""}
      </figure>
    `;
  }

  if (type === "page_link") {
    const targetPage = pages.find((page) => page.id === metadata.target_page_id);

    if (!targetPage) return "";

    return `
      <p class="book-inline-link">
        <button type="button" data-page-id="${targetPage.id}">
          Turn to ${escapeHtml(metadata.label || targetPage.title)}
        </button>
      </p>
    `;
  }

  if (!String(content || "").trim()) return "";

  return `<p>${richText(content)}</p>`;
}

function renderReadableList(content, listType) {
  const items = String(content || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) return `<p class="book-placeholder">Empty list.</p>`;

  if (listType === "checklist") {
    return `
      <ul class="book-checklist">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `;
  }

  const tag = listType === "ol" ? "ol" : "ul";

  return `
    <${tag}>
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </${tag}>
  `;
}

function renderReadablePageLinks() {
  if (!pageLinks.length) return "";

  return `
    <section class="book-linked-pages">
      <h2>Linked Pages</h2>

      <div>
        ${pageLinks
          .map((link) => {
            const target = pages.find((page) => page.id === link.target_page_id);
            if (!target) return "";

            return `
              <button type="button" data-page-id="${target.id}">
                ${escapeHtml(link.link_label || target.title)}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

/* =========================================================
   EDITOR
   ========================================================= */

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

        <div class="book-rich-toolbar" data-rich-toolbar>
          <button type="button" data-rich-command="bold"><strong>B</strong></button>
          <button type="button" data-rich-command="italic"><em>I</em></button>
          <button type="button" data-rich-command="underline"><u>U</u></button>
          <button type="button" data-rich-command="createLink">Link</button>
        </div>

        <div class="book-editor-actions">
          <button class="button button--primary button--small" type="button" data-done-editing>
            Done
          </button>

          <button class="button button--small" type="button" data-open-template-menu>
            Templates
          </button>

          <button class="button button--small" type="button" data-link-existing-page>
            Link Page
          </button>

          <button class="button button--small" type="button" data-return-page-to-ashes>
            Return to Ashes
          </button>
        </div>
      </header>

      <div class="book-editor-elements">
        ${currentBlocks.map((block, index) => renderEditableElement(block, index)).join("")}
      </div>

      <div class="book-add-elements">
        ${renderElementButtons()}
      </div>
    </section>
  `;
}

function renderElementButtons() {
  const groups = [...new Set(ELEMENT_TYPES.map((item) => item.group))];

  return `
    <details class="book-add-drawer">
      <summary>✦ Add Page Element</summary>

      <div class="book-add-drawer-panel">
        ${groups
          .map((group) => {
            const groupItems = ELEMENT_TYPES.filter((item) => item.group === group);

            return `
              <div class="book-element-group">
                <p>${group}</p>

                <div>
                  ${groupItems
                    .map(
                      (item) => `
                        <button type="button" data-add-block-type="${item.type}">
                          + ${item.label}
                        </button>
                      `
                    )
                    .join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </details>
  `;
}

function renderEditableElement(block, index) {
  const type = block.block_type;
  const content = blockContent(block);
  const metadata = getBlockMetadata(block);

  const controls = `
    <div class="book-element-controls">
      <button type="button" data-move-block-up="${block.id}" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-move-block-down="${block.id}" ${index === currentBlocks.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" data-delete-block="${block.id}">Remove</button>
    </div>
  `;

  if (type === "heading") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Heading
          <div
            class="book-rich-input book-rich-heading"
            contenteditable="true"
            data-rich-input
            data-block-input
            data-block-id="${block.id}"
          >${sanitizeHtml(content)}</div>
        </label>
      </section>
    `;
  }

  if (type === "quote") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Quote
          <div
            class="book-rich-input"
            contenteditable="true"
            data-rich-input
            data-block-input
            data-block-id="${block.id}"
          >${sanitizeHtml(content)}</div>
        </label>
      </section>
    `;
  }

  if (type === "callout") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Callout
          <div
            class="book-rich-input book-rich-callout"
            contenteditable="true"
            data-rich-input
            data-block-input
            data-block-id="${block.id}"
          >${sanitizeHtml(content)}</div>
        </label>
      </section>
    `;
  }

  if (type === "divider") {
    return `
      <section class="book-edit-element book-edit-element--divider" data-block-id="${block.id}">
        ${controls}
        <p>Divider</p>
        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>
      </section>
    `;
  }

  if (["checklist", "bulleted_list", "numbered_list", "ingredient_list"].includes(type)) {
    const label = ELEMENT_TYPES.find((item) => item.type === type)?.label || "List";

    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          ${label}
          <textarea
            rows="6"
            data-block-input
            data-block-id="${block.id}"
            placeholder="One item per line"
          >${escapeHtml(content)}</textarea>
        </label>
      </section>
    `;
  }

  if (type === "correspondence") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Correspondence Box
          <textarea
            rows="6"
            data-block-input
            data-block-id="${block.id}"
            placeholder="Planet:\nElement:\nDeities:\nUses:"
          >${escapeHtml(content)}</textarea>
        </label>
      </section>
    `;
  }

  if (type === "image") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Image URL
          <input
            type="url"
            value="${escapeHtml(metadata.url || content)}"
            data-block-input
            data-block-id="${block.id}"
            data-metadata-field="url"
          />
        </label>

        <label>
          Caption
          <input
            type="text"
            value="${escapeHtml(metadata.caption || "")}"
            data-block-metadata-input
            data-block-id="${block.id}"
            data-metadata-field="caption"
          />
        </label>
      </section>
    `;
  }

  if (type === "page_link") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <p>Page Link</p>

        <button type="button" data-choose-page-for-block="${block.id}">
          ${metadata.target_page_id ? "Change Linked Page" : "Choose Linked Page"}
        </button>

        <p class="book-section-empty">
          ${
            metadata.target_page_id
              ? `Linked to ${escapeHtml(pages.find((page) => page.id === metadata.target_page_id)?.title || "page")}`
              : "No page linked yet."
          }
        </p>
      </section>
    `;
  }

  return `
    <section class="book-edit-element" data-block-id="${block.id}">
      ${controls}

      <label>
        Paragraph
        <div
          class="book-rich-input"
          contenteditable="true"
          data-rich-input
          data-block-input
          data-block-id="${block.id}"
        >${sanitizeHtml(content)}</div>
      </label>
    </section>
  `;
}

/* =========================================================
   CREATE
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

async function createElement(type = "text") {
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
      metadata: {},
      rich_content: null,
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
  flashStatus("Element added.");
}

/* =========================================================
   SAVE
   ========================================================= */

async function saveBlock(blockId, value, isRich = false) {
  const updatePayload = isRich
    ? {
        content: value,
        rich_content: { html: sanitizeHtml(value) },
        updated_at: new Date().toISOString()
      }
    : {
        content: value,
        updated_at: new Date().toISOString()
      };

  const { data, error } = await db
    .from("grimoire_blocks")
    .update(updatePayload)
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

  flashStatus("Saved.");
}

async function saveBlockMetadata(blockId, field, value) {
  const block = currentBlocks.find((item) => item.id === blockId);
  if (!block) return;

  const metadata = {
    ...getBlockMetadata(block),
    [field]: value
  };

  const { data, error } = await db
    .from("grimoire_blocks")
    .update({
      metadata,
      content: field === "url" ? value : block.content,
      updated_at: new Date().toISOString()
    })
    .eq("id", blockId)
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.map((item) =>
    item.id === data.id ? data : item
  );

  flashStatus("Saved.");
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
  flashStatus("Title saved.");
}

async function saveAllVisibleEdits() {
  const titleInput = document.querySelector("[data-page-title-input]");
  const blockInputs = document.querySelectorAll("[data-block-input]");
  const metadataInputs = document.querySelectorAll("[data-block-metadata-input]");

  const jobs = [];

  if (titleInput && currentPage) {
    const newTitle = titleInput.value.trim() || "Untitled Page";

    jobs.push(
      db
        .from("grimoire_pages")
        .update({
          title: newTitle,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentPage.id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;

          currentPage = data;
          pages = pages.map((page) => (page.id === data.id ? data : page));
        })
    );
  }

  blockInputs.forEach((input) => {
    const blockId = input.dataset.blockId;
    const isRich = input.hasAttribute("contenteditable");
    const metadataField = input.dataset.metadataField;

    if (metadataField) {
      jobs.push(saveBlockMetadata(blockId, metadataField, input.value));
      return;
    }

    const value = isRich ? input.innerHTML : input.value;

    jobs.push(saveBlock(blockId, value, isRich));
  });

  metadataInputs.forEach((input) => {
    jobs.push(saveBlockMetadata(input.dataset.blockId, input.dataset.metadataField, input.value));
  });

  await Promise.all(jobs);
}

/* =========================================================
   MOVE AND DELETE
   ========================================================= */

async function moveBlock(blockId, direction) {
  const index = currentBlocks.findIndex((block) => block.id === blockId);
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= currentBlocks.length) return;

  const reordered = [...currentBlocks];
  const [movedBlock] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, movedBlock);

  currentBlocks = reordered.map((block, newIndex) => ({
    ...block,
    sort_order: newIndex
  }));

  renderEditor();

  const jobs = currentBlocks.map((block) =>
    db
      .from("grimoire_blocks")
      .update({ sort_order: block.sort_order })
      .eq("id", block.id)
  );

  const results = await Promise.all(jobs);
  const failed = results.find((result) => result.error);

  if (failed) {
    setStatus(failed.error.message);
    await loadBlocks(currentPage);
    renderEditor();
    return;
  }

  flashStatus("Element moved.");
}

async function deleteBlock(blockId) {
  if (currentBlocks.length === 1) {
    flashStatus("A page needs at least one paragraph.");
    return;
  }

  const confirmed = window.confirm("Remove this element from the page?");
  if (!confirmed) return;

  const { error } = await db.from("grimoire_blocks").delete().eq("id", blockId);

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.filter((block) => block.id !== blockId);
  currentBlocks = currentBlocks.map((block, index) => ({
    ...block,
    sort_order: index
  }));

  renderEditor();
  flashStatus("Element removed.");
}

async function returnCurrentPageToAshes() {
  const user = requireUser();
  if (!user || !currentPage) return;

  const confirmed = window.confirm(
    `Return "${currentPage.title}" to ashes? This cannot be undone.`
  );

  if (!confirmed) return;

  const pageId = currentPage.id;

  const { error } = await db.from("grimoire_pages").delete().eq("id", pageId);

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
   LINKS
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
   TEMPLATES AND MODALS
   ========================================================= */

function ensureModalRoot() {
  let root = document.querySelector("[data-book-modal-root]");

  if (!root) {
    root = document.createElement("div");
    root.dataset.bookModalRoot = "";
    document.body.appendChild(root);
  }

  return root;
}

function closeBookModal(value = null) {
  const root = document.querySelector("[data-book-modal-root]");
  if (root) root.innerHTML = "";

  if (typeof closeBookModal.resolve === "function") {
    closeBookModal.resolve(value);
    closeBookModal.resolve = null;
  }
}

function openModal(title, bodyHtml) {
  const root = ensureModalRoot();

  root.innerHTML = `
    <div class="book-modal-backdrop" data-close-book-modal>
      <section class="book-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <h2>${escapeHtml(title)}</h2>
          <button type="button" data-close-book-modal>×</button>
        </header>

        <div class="book-modal-body">
          ${bodyHtml}
        </div>
      </section>
    </div>
  `;

  return new Promise((resolve) => {
    closeBookModal.resolve = resolve;
  });
}

function openPageTemplateChooser() {
  const buttons = Object.entries(PAGE_TEMPLATES)
    .map(
      ([key, template]) => `
        <button type="button" data-choose-template="${key}">
          ${escapeHtml(template.label)}
        </button>
      `
    )
    .join("");

  return openModal(
    "Create a Page",
    `<div class="book-template-grid">${buttons}</div>`
  );
}

function openPageChooser(title = "Choose a Page") {
  const availablePages = pages.filter((page) => !currentPage || page.id !== currentPage.id);

  const buttons = availablePages
    .map(
      (page) => `
        <button type="button" data-choose-page="${page.id}">
          ${escapeHtml(page.title)}
        </button>
      `
    )
    .join("");

  return openModal(
    title,
    `<div class="book-template-grid">${buttons || "<p>No other pages yet.</p>"}</div>`
  );
}

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
   RICH TEXT
   ========================================================= */

function runRichCommand(command) {
  if (!activeRichEditor) return;

  activeRichEditor.focus();

  if (command === "createLink") {
    const url = window.prompt("Paste the link URL:");
    if (!url) return;

    document.execCommand("createLink", false, url);
    return;
  }

  document.execCommand(command, false, null);
}

/* =========================================================
   SEARCH
   ========================================================= */

function applySearch() {
  if (!entryList) return;

  if (!searchTerm.trim()) {
    if (currentPage) {
      renderPage();
    } else if (pages.length > 0) {
      openPage(pages[0].id, "read");
    } else {
      renderWelcomeState();
    }

    return;
  }

  const results = pages.filter((page) =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  hideEmptyState();

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


async function moveSection(sectionId, direction) {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sections.length) return;

  const reordered = [...sections];
  const [movedSection] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, movedSection);

  sections = reordered.map((section, newIndex) => ({
    ...section,
    sort_order: newIndex
  }));

  renderShelf();

  const jobs = sections.map((section) =>
    db
      .from("grimoire_sections")
      .update({ sort_order: section.sort_order })
      .eq("id", section.id)
  );

  const results = await Promise.all(jobs);
  const failed = results.find((result) => result.error);

  if (failed) {
    setStatus(failed.error.message);
    await loadSections();
    renderShelf();
    return;
  }

  flashStatus("Section moved.");
}

async function movePageInSection(pageId, direction) {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return;

  const pageGroup = pages
    .filter((item) => item.section_id === page.section_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const index = pageGroup.findIndex((item) => item.id === pageId);
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= pageGroup.length) return;

  const reorderedGroup = [...pageGroup];
  const [movedPage] = reorderedGroup.splice(index, 1);
  reorderedGroup.splice(targetIndex, 0, movedPage);

  const updatedGroup = reorderedGroup.map((item, newIndex) => ({
    ...item,
    sort_order: newIndex
  }));

  pages = pages.map((item) => {
    const updatedPage = updatedGroup.find((pageItem) => pageItem.id === item.id);
    return updatedPage || item;
  });

  renderShelf();

  const jobs = updatedGroup.map((item) =>
    db
      .from("grimoire_pages")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id)
  );

  const results = await Promise.all(jobs);
  const failed = results.find((result) => result.error);

  if (failed) {
    setStatus(failed.error.message);
    await loadPages();
    renderShelf();
    return;
  }

  flashStatus("Page moved.");
}

function updateMundaneModeUI() {
  document.body.classList.toggle("is-mundane-mode", mundaneMode);

  if (mundaneToggle) {
    mundaneToggle.checked = mundaneMode;
  }

  const coverEyebrow = document.querySelector("[data-cover-eyebrow]");
  const coverTitle = document.querySelector("[data-cover-title]");
  const coverText = document.querySelector("[data-cover-text]");

  if (coverEyebrow) {
    coverEyebrow.textContent = mundaneMode ? "Private Journal" : "Private Grimoire";
  }

  if (coverTitle) {
    coverTitle.textContent = mundaneMode ? "Personal Journal" : "Book of Shadows";
  }

  if (coverText) {
    coverText.textContent = mundaneMode
      ? "A private place for personal notes, reflections, and daily writing."
      : "A living archive of your practice. Create your own sections, turn to your own pages, and let the book become what your path requires.";
  }

  if (currentPage) {
    renderPage();
  }
}

function getDisplayPageTitle() {
  if (!currentPage) return "Welcome";

  if (mundaneMode) {
    return formatDate(currentPage.created_at) || "Journal Entry";
  }

  return currentPage.title;
}

/* =========================================================
   EVENTS
   ========================================================= */

if (entrySearch) {
  entrySearch.addEventListener("input", () => {
    searchTerm = entrySearch.value;
    applySearch();
  });
}

if (editToggleButton) {
  editToggleButton.addEventListener("click", async () => {
    if (!currentPage) return;

    if (pageMode === "edit") {
      try {
        await saveAllVisibleEdits();
        pageMode = "read";
        updateEditButton();
        renderReader();
        flashStatus("Saved.");
      } catch (error) {
        console.error("Could not save page:", error);
        setStatus(error.message || "This page could not be saved.");
      }

      return;
    }

    pageMode = "edit";
    updateEditButton();
    renderEditor();
  });
}

document.addEventListener("click", async (event) => {
  const createSectionButton = event.target.closest("[data-create-section]");
  const createPageButton = event.target.closest("[data-create-page]");
  const toggleSectionButton = event.target.closest("[data-toggle-section]");
  const pageButton = event.target.closest("[data-page-id]");
  const addBlockButton = event.target.closest("[data-add-block-type]");
  const deleteBlockButton = event.target.closest("[data-delete-block]");
  const ashesButton = event.target.closest("[data-return-page-to-ashes]");
  const doneButton = event.target.closest("[data-done-editing]");
  const moveUpButton = event.target.closest("[data-move-block-up]");
  const moveDownButton = event.target.closest("[data-move-block-down]");
  const templateButton = event.target.closest("[data-open-template-menu]");
  const linkPageButton = event.target.closest("[data-link-existing-page]");
  const chooseTemplateButton = event.target.closest("[data-choose-template]");
  const choosePageButton = event.target.closest("[data-choose-page]");
  const choosePageForBlockButton = event.target.closest("[data-choose-page-for-block]");
  const richButton = event.target.closest("[data-rich-command]");
  const closeModalButton = event.target.closest("[data-close-book-modal]");
   const moveSectionUpButton = event.target.closest("[data-move-section-up]");
   const moveSectionDownButton = event.target.closest("[data-move-section-down]");
   const movePageUpButton = event.target.closest("[data-move-page-up]");
   const movePageDownButton = event.target.closest("[data-move-page-down]");

  if (createSectionButton) {
    createSection();
    return;
  }

  if (createPageButton) {
    createPage();
    return;
  }

  if (toggleSectionButton) {
    toggleSection(toggleSectionButton.dataset.toggleSection);
    return;
  }

  if (pageButton) {
    await openPage(pageButton.dataset.pageId, "read");
    return;
  }

  if (addBlockButton) {
    createElement(addBlockButton.dataset.addBlockType);
    return;
  }

  if (deleteBlockButton) {
    deleteBlock(deleteBlockButton.dataset.deleteBlock);
    return;
  }

  if (moveUpButton) {
    moveBlock(moveUpButton.dataset.moveBlockUp, "up");
    return;
  }

  if (moveDownButton) {
    moveBlock(moveDownButton.dataset.moveBlockDown, "down");
    return;
  }

  if (ashesButton) {
    returnCurrentPageToAshes();
    return;
  }

  if (doneButton) {
    try {
      await saveAllVisibleEdits();
      pageMode = "read";
      updateEditButton();
      renderReader();
      flashStatus("Saved.");
    } catch (error) {
      console.error("Could not finish editing:", error);
      setStatus(error.message || "This page could not be saved.");
    }

    return;
  }

  if (templateButton) {
    applyTemplateToCurrentPage();
    return;
  }

  if (linkPageButton) {
    linkExistingPage();
    return;
  }

  if (choosePageForBlockButton) {
    choosePageForBlock(choosePageForBlockButton.dataset.choosePageForBlock);
    return;
  }

  if (richButton) {
    runRichCommand(richButton.dataset.richCommand);
    return;
  }

  if (chooseTemplateButton) {
    closeBookModal(chooseTemplateButton.dataset.chooseTemplate);
    return;
  }

  if (choosePageButton) {
    const page = pages.find((item) => item.id === choosePageButton.dataset.choosePage);
    closeBookModal(page || null);
    return;
  }

  if (closeModalButton) {
    if (event.target === closeModalButton || closeModalButton.tagName === "BUTTON") {
      closeBookModal(null);
    }
  }

   if (moveSectionUpButton) {
     moveSection(moveSectionUpButton.dataset.moveSectionUp, "up");
     return;
   }
   
   if (moveSectionDownButton) {
     moveSection(moveSectionDownButton.dataset.moveSectionDown, "down");
     return;
   }
   
   if (movePageUpButton) {
     movePageInSection(movePageUpButton.dataset.movePageUp, "up");
     return;
   }
   
   if (movePageDownButton) {
     movePageInSection(movePageDownButton.dataset.movePageDown, "down");
     return;
   }
});

document.addEventListener("focusin", (event) => {
  const richInput = event.target.closest("[data-rich-input]");

  if (richInput) {
    activeRichEditor = richInput;
  }
});

document.addEventListener("input", (event) => {
  const blockInput = event.target.closest("[data-block-input]");
  const metadataInput = event.target.closest("[data-block-metadata-input]");
  const titleInput = event.target.closest("[data-page-title-input]");

  if (blockInput) {
    const isRich = blockInput.hasAttribute("contenteditable");
    const metadataField = blockInput.dataset.metadataField;

    if (metadataField) {
      debounceSave(`${blockInput.dataset.blockId}-${metadataField}`, () => {
        saveBlockMetadata(blockInput.dataset.blockId, metadataField, blockInput.value);
      });
      return;
    }

    debounceSave(blockInput.dataset.blockId, () => {
      const value = isRich ? blockInput.innerHTML : blockInput.value;
      saveBlock(blockInput.dataset.blockId, value, isRich);
    });
  }

  if (metadataInput) {
    debounceSave(`${metadataInput.dataset.blockId}-${metadataInput.dataset.metadataField}`, () => {
      saveBlockMetadata(
        metadataInput.dataset.blockId,
        metadataInput.dataset.metadataField,
        metadataInput.value
      );
    });
  }

  if (titleInput) {
    debounceSave("page-title", saveCurrentPageTitle);
  }
});

document.addEventListener("saltAuthChanged", updateAuthState);
document.addEventListener("saltAuthSuccess", updateAuthState);

if (mundaneToggle) {
  mundaneToggle.checked = mundaneMode;

  mundaneToggle.addEventListener("change", () => {
    mundaneMode = mundaneToggle.checked;
    localStorage.setItem("saltMundaneMode", String(mundaneMode));
    updateMundaneModeUI();
  });
}

updateMundaneModeUI();

updateAuthState();
