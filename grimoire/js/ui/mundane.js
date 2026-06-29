/* =========================================================
   GRIMOIRE MUNDANE MODE
   File: grimoire/js/mundane.js
   ========================================================= */

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
