/* =========================================================
   TRADITIONAL LIVING LIBRARY SHELF
   Restores the Traditional Information table-of-contents renderer.
   ========================================================= */

function getTraditionalLibraryEntityTypes() {
  if (typeof Library === "undefined") return [];

  const entities = Object.values(Library.exportLibrary()?.entities || {});

  return [...new Set(
    entities
      .filter((entity) => entity.traditional && Object.keys(entity.traditional).length)
      .map((entity) => entity.type)
      .filter(Boolean)
  )].sort((a, b) => getTraditionalTypeLabel(a).localeCompare(getTraditionalTypeLabel(b)));
}

async function renderTraditionalLibraryShelf() {
  if (!grimoireShelf || typeof Library === "undefined") return;

  const existing = grimoireShelf.querySelector("[data-traditional-library-shelf]");
  if (existing) existing.remove();

  const settings = typeof getMySettings === "function"
    ? await getMySettings()
    : {};

  if (settings.library_traditional_enabled === false) return;

  if (typeof Library.importTraditionalLibrary === "function") {
    Library.importTraditionalLibrary();
  }

  const types = getTraditionalLibraryEntityTypes();
  const wrapper = document.createElement("section");
  wrapper.className = "book-toc-section traditional-library-shelf";
  wrapper.setAttribute("data-traditional-library-shelf", "");

  wrapper.innerHTML = `
    <button
      class="book-section-title traditional-library-title"
      type="button"
      data-traditional-library-toggle>
      <span>Traditional Information</span>
    </button>

    <div
      class="book-section-pages traditional-library-root"
      data-traditional-library-list
      ${isLibraryShelfOpen("traditional-root") ? "" : "hidden"}>
      ${types.length
        ? types.map((type) => {
            const entities = Object.values(Library.exportLibrary()?.entities || {})
              .filter((entity) => (
                entity.type === type
                && entity.traditional
                && Object.keys(entity.traditional).length
              ))
              .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

            const groupKey = `traditional-${type}`;
            const isOpen = isLibraryShelfOpen(groupKey);

            return `
              <div class="traditional-library-group" data-traditional-library-group="${type}">
                <button
                  class="traditional-library-group-title"
                  type="button"
                  data-library-type-toggle="${type}">
                  <span>${isOpen ? "▾" : "▸"}</span>
                  ${getTraditionalTypeLabel(type)}
                </button>

                <div
                  class="traditional-library-entity-list"
                  data-library-type-list="${type}"
                  ${isOpen ? "" : "hidden"}>
                  ${entities.map((entity) => `
                    <button
                      type="button"
                      class="book-page-link traditional-library-entity-link ${activeLibraryEntityId === entity.id ? "is-active" : ""}"
                      data-library-entity-id="${entity.id}">
                      ${formatLibraryEntityName(entity.name)}
                    </button>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")
        : `<p class="book-section-empty">No traditional entries are available yet.</p>`}
    </div>
  `;

  const myPracticeShelf = grimoireShelf.querySelector("[data-my-practice-shelf]");

  if (myPracticeShelf) {
    myPracticeShelf.insertAdjacentElement("afterend", wrapper);
  } else {
    grimoireShelf.prepend(wrapper);
  }
}
