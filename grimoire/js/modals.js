/* =========================================================
   GRIMOIRE MODALS
   File: grimoire/js/modals.js
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
