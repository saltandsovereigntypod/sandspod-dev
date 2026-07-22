/* =========================================================
   APOTHECARY STABILITY PATCH
   Prevents stale asynchronous loads from replacing newly saved items.
   ========================================================= */

(() => {
  let refreshPromise = null;

  async function refreshApothecarySafely() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      if (typeof migrateLocalApothecaryToCloud === "function") {
        await migrateLocalApothecaryToCloud();
      }

      if (typeof loadApothecaryItems === "function") {
        await loadApothecaryItems();
      }

      if (typeof renderApothecaryItems === "function") {
        renderApothecaryItems();
      }
    })();

    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  window.refreshApothecarySafely = refreshApothecarySafely;

  window.openAltarApothecaryOverlay = function openAltarApothecaryOverlay() {
    const overlay = document.querySelector("[data-altar-apothecary-overlay]");
    if (!overlay) return;

    overlay.hidden = false;
    overlay.setAttribute("aria-busy", "true");
    document.body.classList.add("altar-cabinet-overlay-open");

    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
    });

    refreshApothecarySafely()
      .catch((error) => {
        console.error("[Apothecary] Refresh failed", error);
        if (typeof showAltarToast === "function") {
          showAltarToast("Could not refresh My Apothecary");
        }
      })
      .finally(() => {
        overlay.removeAttribute("aria-busy");
      });
  };

  document.addEventListener("altar.apothecary.saved", () => {
    if (typeof renderApothecaryItems === "function") {
      renderApothecaryItems();
    }
  });
})();
