/* =========================================================
   TRADITIONAL LIVING LIBRARY VISIBILITY
   The Traditional shelf follows the enabled library layer,
   not the retired legacy grimoire sync toggle.
   ========================================================= */

// app.js still checks the retired sync_traditional_library_to_grimoire
// setting before rendering the Traditional Information shelf. This file
// loads after app.js, so replace that legacy gate with the current setting.
async function shouldShowTraditionalLibrary() {
  if (typeof getMySettings !== "function") return true;

  const settings = await getMySettings();
  return settings.library_traditional_enabled !== false;
}

async function ensureTraditionalLivingLibraryIsVisible() {
  if (typeof TraditionalLibrary === "undefined") return;
  if (typeof Library === "undefined") return;
  if (typeof getMySettings !== "function") return;

  const settings = await getMySettings();
  if (settings.library_traditional_enabled === false) return;

  Library.importTraditionalLibrary();

  if (typeof renderLivingLibraryShelves === "function") {
    await renderLivingLibraryShelves();
  }
}

window.addEventListener("load", () => {
  window.setTimeout(() => {
    ensureTraditionalLivingLibraryIsVisible().catch((error) => {
      console.error("Traditional Living Library could not be shown:", error);
    });
  }, 250);
});

window.addEventListener("saltSettingsChanged", () => {
  ensureTraditionalLivingLibraryIsVisible().catch((error) => {
    console.error("Traditional Living Library settings refresh failed:", error);
  });
});
