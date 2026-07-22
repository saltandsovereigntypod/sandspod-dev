/* =========================================================
   LIVING LIBRARY SIDEBAR CONTROLLER
   Keeps Book of Shadows navigation aligned with the current
   Living Library settings without changing layer ownership.
   ========================================================= */

// The old sync option created legacy grimoire pages. Traditional
// Information now lives only in the read-only Living Library layer.
async function syncTraditionalLibraryToGrimoireIfEnabled() {
  return;
}

// Traditional visibility in the Book of Shadows follows the current
// Living Library setting, not the retired legacy sync preference.
async function shouldShowTraditionalLibrary() {
  if (typeof getMySettings !== "function") return true;

  const settings = await getMySettings();
  return settings.library_traditional_enabled !== false;
}

const renderMyPracticeShelfFromApp =
  typeof renderMyPracticeShelf === "function"
    ? renderMyPracticeShelf
    : null;

// Keep the My Practice navigation shelf aligned with the same setting
// that controls its layer on Living Library entity pages.
if (renderMyPracticeShelfFromApp) {
  renderMyPracticeShelf = async function renderConfiguredMyPracticeShelf() {
    const existing = grimoireShelf?.querySelector("[data-my-practice-shelf]");
    if (existing) existing.remove();

    const settings = typeof getMySettings === "function"
      ? await getMySettings()
      : {};

    if (settings.library_myPractice_enabled === false) return;

    await renderMyPracticeShelfFromApp();
  };
}

let livingLibrarySidebarRenderPending = false;

function scheduleLivingLibrarySidebarRender() {
  if (livingLibrarySidebarRenderPending) return;
  livingLibrarySidebarRenderPending = true;

  window.setTimeout(() => {
    livingLibrarySidebarRenderPending = false;

    if (typeof renderLivingLibraryShelves !== "function") return;

    renderLivingLibraryShelves().catch((error) => {
      console.error("Living Library sidebar could not be rendered:", error);
    });
  }, 0);
}

window.addEventListener("load", scheduleLivingLibrarySidebarRender);
window.addEventListener("saltSettingsChanged", scheduleLivingLibrarySidebarRender);
