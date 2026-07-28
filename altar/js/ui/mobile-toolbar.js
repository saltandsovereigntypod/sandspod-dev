/* =========================================================
   MOBILE OBJECT TOOLBAR
   Keeps responsive object action overflow synchronized with the viewport.
   ========================================================= */

(function initializeMobileObjectToolbar() {
  const mobileQuery = window.matchMedia("(max-width: 900px)");
  function refreshToolbarForViewport() {
    if (typeof renderSelectedObjectActions === "function") {
      renderSelectedObjectActions();
    }
  }

  refreshToolbarForViewport();

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", refreshToolbarForViewport);
  } else {
    mobileQuery.addListener(refreshToolbarForViewport);
  }

  window.addEventListener("orientationchange", () => {
    window.requestAnimationFrame(refreshToolbarForViewport);
  });
})();
