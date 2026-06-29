/* =========================================================
   GRIMOIRE SEARCH
   File: grimoire/js/search.js
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
