/* =========================================================
   TRADITIONAL LIVING LIBRARY SHELF
   Builds the Traditional Information table of contents directly
   from the curated source and restores it after sidebar rebuilds.
   ========================================================= */

let traditionalShelfRenderPending = false;
let traditionalShelfIsRendering = false;

function getTraditionalSourceTypes() {
  if (typeof TraditionalLibrary === "undefined") return [];

  return Object.keys(TraditionalLibrary)
    .filter((type) => TraditionalLibrary[type] && Object.keys(TraditionalLibrary[type]).length)
    .sort((a, b) => getTraditionalTypeLabel(a).localeCompare(getTraditionalTypeLabel(b)));
}

function findTraditionalLivingLibraryEntity(type, key, data = {}) {
  if (typeof Library === "undefined") return null;

  const normalizedNames = new Set([
    String(key || "").replaceAll("_", " ").trim().toLowerCase(),
    String(data.DisplayName || "").trim().toLowerCase()
  ].filter(Boolean));

  return Object.values(Library.exportLibrary()?.entities || {}).find((entity) => {
    return entity.type === type && normalizedNames.has(String(entity.name || "").trim().toLowerCase());
  }) || null;
}

async function renderTraditionalLibraryShelf() {
  if (!grimoireShelf || typeof TraditionalLibrary === "undefined") return;
  if (traditionalShelfIsRendering) return;

  traditionalShelfIsRendering = true;

  try {
    const settings = typeof getMySettings === "function"
      ? await getMySettings()
      : {};

    const existing = grimoireShelf.querySelector("[data-traditional-library-shelf]");
    if (existing) existing.remove();

    if (settings.library_traditional_enabled === false) return;

    if (typeof Library !== "undefined" && typeof Library.importTraditionalLibrary === "function") {
      Library.importTraditionalLibrary();
    }

    const types = getTraditionalSourceTypes();
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
        ${types.map((type) => {
          const groupKey = `traditional-${type}`;
          const isOpen = isLibraryShelfOpen(groupKey);
          const entries = Object.entries(TraditionalLibrary[type] || {})
            .map(([key, data]) => ({
              key,
              data,
              entity: findTraditionalLivingLibraryEntity(type, key, data)
            }))
            .filter((entry) => entry.entity)
            .sort((a, b) => {
              const aName = a.data.DisplayName || a.entity.name || a.key;
              const bName = b.data.DisplayName || b.entity.name || b.key;
              return String(aName).localeCompare(String(bName));
            });

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
                ${entries.length
                  ? entries.map(({ key, data, entity }) => `
                      <button
                        type="button"
                        class="book-page-link traditional-library-entity-link ${activeLibraryEntityId === entity.id ? "is-active" : ""}"
                        data-library-entity-id="${entity.id}">
                        ${formatLibraryEntityName(data.DisplayName || entity.name || key)}
                      </button>
                    `).join("")
                  : `<p class="book-section-empty">No entries available.</p>`}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    const myPracticeShelf = grimoireShelf.querySelector("[data-my-practice-shelf]");
    const baseShelf = grimoireShelf.querySelector(".book-section-list");

    if (myPracticeShelf) {
      myPracticeShelf.insertAdjacentElement("afterend", wrapper);
    } else if (baseShelf) {
      baseShelf.insertAdjacentElement("beforebegin", wrapper);
    } else {
      grimoireShelf.prepend(wrapper);
    }
  } finally {
    traditionalShelfIsRendering = false;
  }
}

function scheduleTraditionalShelfRender() {
  if (traditionalShelfRenderPending) return;
  traditionalShelfRenderPending = true;

  window.setTimeout(() => {
    traditionalShelfRenderPending = false;
    renderTraditionalLibraryShelf().catch((error) => {
      console.error("Traditional Information shelf could not be rendered:", error);
    });
  }, 0);
}

function observeTraditionalShelfLifecycle() {
  if (!grimoireShelf) return;

  const observer = new MutationObserver((mutations) => {
    if (traditionalShelfIsRendering) return;

    const sidebarWasRebuilt = mutations.some((mutation) => {
      return mutation.type === "childList" && mutation.target === grimoireShelf;
    });

    if (sidebarWasRebuilt && !grimoireShelf.querySelector("[data-traditional-library-shelf]")) {
      scheduleTraditionalShelfRender();
    }
  });

  observer.observe(grimoireShelf, { childList: true });
  scheduleTraditionalShelfRender();
}

window.addEventListener("load", observeTraditionalShelfLifecycle);
