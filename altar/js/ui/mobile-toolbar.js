/* =========================================================
   MOBILE OBJECT TOOLBAR
   Places selected-object controls inside the existing altar action bar
   on mobile while preserving the desktop altar overlay.
   ========================================================= */

(function initializeMobileObjectToolbar() {
  const mobileQuery = window.matchMedia("(max-width: 900px)");
  const stage = document.querySelector("[data-altar-stage]");
  const actionBar = document.querySelector(".altar-action-bar");
  const toolbar = document.querySelector(".altar-toolbar");

  if (!stage || !actionBar || !toolbar) return;

  const desktopAnchor = document.createComment("altar-toolbar-desktop-anchor");
  stage.insertBefore(desktopAnchor, toolbar);

  function moveToolbarForViewport() {
    if (mobileQuery.matches) {
      if (toolbar.parentElement !== actionBar) {
        actionBar.prepend(toolbar);
      }

      toolbar.classList.add("is-in-action-bar");
      return;
    }

    if (toolbar.parentElement !== stage) {
      desktopAnchor.after(toolbar);
    }

    toolbar.classList.remove("is-in-action-bar");
  }

  moveToolbarForViewport();

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", moveToolbarForViewport);
  } else {
    mobileQuery.addListener(moveToolbarForViewport);
  }

  window.addEventListener("orientationchange", () => {
    window.requestAnimationFrame(moveToolbarForViewport);
  });
})();
