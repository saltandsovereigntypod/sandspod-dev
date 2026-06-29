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

/* =========================================================
   ALTAR IMPORT MODAL
   ========================================================= */

function groupAltarItemsByType(items = []) {
  return items.reduce((groups, item) => {
    const type = item.type || "item";
    const label = ALTAR_IMPORT_TYPE_LABELS[type] || "Other Items";

    if (!groups[label]) {
      groups[label] = [];
    }

    groups[label].push(item);
    return groups;
  }, {});
}

function renderAltarImportSummary(ritual) {
  const groupedItems = groupAltarItemsByType(ritual.items || []);

  return Object.entries(groupedItems)
    .map(([groupLabel, items]) => {
      return `
        <section class="book-import-group">
          <h3>${escapeHtml(groupLabel)}</h3>

          <ul>
            ${items
              .map((item) => `<li>${escapeHtml(item.label || "Altar Item")}</li>`)
              .join("")}
          </ul>
        </section>
      `;
    })
    .join("");
}

function openAltarImportModal(ritual) {
  const bodyHtml = `
    <div class="book-import-modal">
      <p class="eyebrow">Record Ritual</p>

      <h2>${escapeHtml(ritual.name || "Ritual Working")}</h2>

      <p>
        A ritual group was brought over from your altar. Review the items below,
        then create a new ritual page in your Grimoire.
      </p>

      <label class="book-import-field">
        Ritual Purpose
        <textarea
          rows="4"
          data-import-purpose
          placeholder="What was this working for?"
        ></textarea>
      </label>

      <div class="book-import-summary">
        ${renderAltarImportSummary(ritual)}
      </div>

      <div class="book-import-actions">
        <button class="button" type="button" data-cancel-altar-import>
          Cancel
        </button>

        <button class="button button--primary" type="button" data-create-altar-ritual>
          Create Ritual Page
        </button>
      </div>
    </div>
  `;

  openModal("Record Ritual", bodyHtml);

  const root = document.querySelector("[data-book-modal-root]");
  if (!root) return;

  const cancelButton = root.querySelector("[data-cancel-altar-import]");
  const createButton = root.querySelector("[data-create-altar-ritual]");
  const purposeInput = root.querySelector("[data-import-purpose]");

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      localStorage.removeItem(ALTAR_GRIMOIRE_HANDOFF_KEY);
      closeBookModal(null);
    });
  }

  if (createButton) {
    createButton.addEventListener("click", async () => {
      await createRitualPageFromAltarImport(
        ritual,
        purposeInput ? purposeInput.value : ""
      );

      localStorage.removeItem(ALTAR_GRIMOIRE_HANDOFF_KEY);
      closeBookModal(null);
    });
  }
}
