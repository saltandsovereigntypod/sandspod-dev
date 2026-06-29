/* =========================================================
   GRIMOIRE SIDEBAR / TABLE OF CONTENTS
   File: grimoire/js/sidebar.js
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

async function moveSection(sectionId, direction) {
  const sortedSections = [...sections].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const index = sortedSections.findIndex((section) => section.id === sectionId);
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sortedSections.length) return;

  const reordered = [...sortedSections];
  const [movedSection] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, movedSection);

  const updatedSections = reordered.map((section, newIndex) => ({
    ...section,
    sort_order: newIndex
  }));

  sections = sections.map((section) => {
    const updated = updatedSections.find((item) => item.id === section.id);
    return updated || section;
  });

  renderShelf();

  const jobs = updatedSections.map((section) =>
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
