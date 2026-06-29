/* =========================================================
   GRIMOIRE READER
   File: grimoire/js/reader.js
   ========================================================= */

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

  if (items.length === 0) {
    return `<p class="book-placeholder">Empty list.</p>`;
  }

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
