/* =========================================================
   EVENTS
   ========================================================= */

toolbar.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !selectedObject) return;

  switch (button.dataset.action) {
    case "smaller":
      pushAltarUndoSnapshot();
      resizeObject(selectedObject, -0.1);
      break;

    case "larger":
      pushAltarUndoSnapshot();
      resizeObject(selectedObject, 0.1);
      break;

    case "rotate-left":
        pushAltarUndoSnapshot();
        rotateObject(selectedObject, -15);
        break;
      
      case "rotate-right":
        pushAltarUndoSnapshot();
        rotateObject(selectedObject, 15);
        break;

    case "delete":
      pushAltarUndoSnapshot();
      deleteObject(selectedObject);
      break;

    case "forward":
      pushAltarUndoSnapshot();
      bringForward(selectedObject);
      break;

    case "backward":
      pushAltarUndoSnapshot();
      sendBackward(selectedObject);
      break;

    case "flip":
      pushAltarUndoSnapshot();
      flipObject(selectedObject);
      break;

    case "lock":
      pushAltarUndoSnapshot();
      toggleLock(selectedObject);
      break;

    case "duplicate":
      pushAltarUndoSnapshot();
      duplicateObject(selectedObject);
      break;

    case "glow":
      pushAltarUndoSnapshot();
      toggleGlow(selectedObject);
      break;

    case "light":
      pushAltarUndoSnapshot();
      toggleLight(selectedObject);
      break;

    case "dress-candle":
      pushAltarUndoSnapshot();
      beginCandleDressing(selectedObject);
      break;
  }
});


/* =========================================================
   CABINET
   ========================================================= */

function openAltarCabinetOverlay() {
  const overlay = document.querySelector("[data-altar-cabinet-overlay]");
  if (!overlay) return;

  overlay.hidden = false;
  document.body.classList.add("altar-cabinet-overlay-open");

  requestAnimationFrame(() => {
    overlay.classList.add("is-visible");
  });

  renderCabinet();
}

function closeAltarCabinetOverlay() {
  const overlay = document.querySelector("[data-altar-cabinet-overlay]");
  if (!overlay) return;

  overlay.classList.remove("is-visible");
  document.body.classList.remove("altar-cabinet-overlay-open");

  window.setTimeout(() => {
    overlay.hidden = true;
  }, 220);
}

function openAltarApothecaryOverlay() {
  const overlay = document.querySelector("[data-altar-apothecary-overlay]");
  if (!overlay) return;

  renderApothecaryShell();

  overlay.hidden = false;
  document.body.classList.add("altar-cabinet-overlay-open");

  requestAnimationFrame(() => {
    overlay.classList.add("is-visible");
  });
}

function closeAltarApothecaryOverlay() {
  const overlay = document.querySelector("[data-altar-apothecary-overlay]");
  if (!overlay) return;

  overlay.classList.remove("is-visible");
  document.body.classList.remove("altar-cabinet-overlay-open");

  window.setTimeout(() => {
    overlay.hidden = true;
  }, 220);
}

function renderApothecaryShell() {
  const overlay = document.querySelector("[data-altar-apothecary-overlay]");
  if (!overlay) return;

  const card = overlay.querySelector(".altar-cabinet");
  if (!card) return;

  card.innerHTML = `
    <button class="altar-cabinet-close" type="button" data-close-apothecary-overlay aria-label="Close">
      ×
    </button>

    <div class="altar-cabinet-header apothecary-header">
      <div>
        <p class="eyebrow">The Apothecary</p>
        <h2>Magical Inventory</h2>
        <p>
          A future home for herbs, oils, crystals, correspondences, warnings, recipes, substitutions, and ritual notes.
        </p>
      </div>

      <div class="apothecary-status-card">
        <strong>Version 2.0 shell</strong>
        <span>Front-end safe. Supabase wiring comes later.</span>
      </div>
    </div>

    <div class="apothecary-tabs" role="tablist" aria-label="Apothecary sections">
      <button type="button" class="is-active" data-apothecary-tab="browse">Browse</button>
      <button type="button" data-apothecary-tab="inventory">Inventory</button>
      <button type="button" data-apothecary-tab="favorites">Favorites</button>
      <button type="button" data-apothecary-tab="recipes">Recipes</button>
      <button type="button" data-apothecary-tab="substitutions">Substitutions</button>
    </div>

    <div class="apothecary-grid">
      <article class="apothecary-card">
        <p class="eyebrow">Browse</p>
        <h3>Correspondence Library</h3>
        <p>Search magical uses, elements, planets, deities, mundane notes, and safety warnings.</p>
        <button type="button" disabled>Coming soon</button>
      </article>

      <article class="apothecary-card">
        <p class="eyebrow">Create</p>
        <h3>Add Custom Item</h3>
        <p>Create your own herb, oil, crystal, powder, salt, water, or ritual ingredient.</p>
        <button type="button" disabled>Create item</button>
      </article>

      <article class="apothecary-card">
        <p class="eyebrow">Inventory</p>
        <h3>Track What You Have</h3>
        <p>Mark items as owned, out of stock, growing, harvesting, or wishlisted.</p>
        <button type="button" disabled>Open inventory</button>
      </article>

      <article class="apothecary-card">
        <p class="eyebrow">Ritual Use</p>
        <h3>Place or Dress</h3>
        <p>Eventually, items can be placed on the altar or used to dress candles directly.</p>
        <button type="button" disabled>Use in ritual</button>
      </article>
    </div>
  `;
}

if (cabinetTabs) {
  cabinetTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cabinet-category]");
    if (!button) return;

    activeCabinetCategory = button.dataset.cabinetCategory;
    renderCabinet();
  });
}

if (cabinetSearch) {
  cabinetSearch.addEventListener("input", () => {
    cabinetSearchTerm = cabinetSearch.value || "";
    renderCabinetItems();
  });
}

if (altarCabinet) {
  altarCabinet.addEventListener("click", (event) => {

    const backgroundButton = event.target.closest("[data-background]");

    if (backgroundButton) {
      changeAltarBackground(backgroundButton);

      return;
    }

    const menuToggle = event.target.closest("[data-form-menu-toggle]");

    if (menuToggle) {
      const wrap = menuToggle.closest(".cabinet-choice-wrap");
      const menu = wrap.querySelector(".cabinet-form-menu");

      cabinetContent
        .querySelectorAll(".cabinet-form-menu")
        .forEach((openMenu) => {
          if (openMenu !== menu) {
            openMenu.hidden = true;
          }
        });

      menu.hidden = !menu.hidden;
      return;
    }

    const itemButton = event.target.closest("[data-image]");

    if (!itemButton) return;

    placeObject({
      imagePath: itemButton.dataset.image || "",
      fallbackSymbol: itemButton.dataset.object || "",
      label: itemButton.dataset.label || "",
      type: itemButton.dataset.type || "",
      herb: itemButton.dataset.herb || "",
      form: itemButton.dataset.form || "",
      color: itemButton.dataset.color || "",
      crystal: itemButton.dataset.crystal || "",
      tool: itemButton.dataset.tool || "",
      vessel: itemButton.dataset.vessel || "",
      deity: itemButton.dataset.deity || ""
    });
  });
}

document.addEventListener("click", (event) => {
  const openCabinetButton = event.target.closest("[data-open-cabinet-overlay]");
  const closeCabinetButton = event.target.closest("[data-close-cabinet-overlay]");
  const openApothecaryButton = event.target.closest("[data-open-apothecary-overlay]");
  const closeApothecaryButton = event.target.closest("[data-close-apothecary-overlay]");

  if (openCabinetButton) {
    openAltarCabinetOverlay();
  }

  if (closeCabinetButton) {
    closeAltarCabinetOverlay();
  }

  if (openApothecaryButton) {
    openAltarApothecaryOverlay();
  }

  if (closeApothecaryButton) {
    closeAltarApothecaryOverlay();
  }
});

/* =========================================================
   ACTION BAR
   ========================================================= */

altarActionBar.addEventListener("click", (event) => {

  const button = event.target.closest("[data-global-action]");

  if (!button || !altarStage) return;

  switch (button.dataset.globalAction) {

    case "undo":
     undoAltarChange();
     return;
   
    case "redo":
     redoAltarChange();
     return;
        
     case "select-ritual-items":
      toggleRitualSelectionMode();
      return;

    case "group-ritual-items":
      pushAltarUndoSnapshot();
      groupSelectedRitualItems();
      return;

    case "ungroup-ritual-items":
      pushAltarUndoSnapshot();
      ungroupCurrentItems();
      return;

    case "start-ritual":
      showAltarToast("Ritual Builder is coming soon");
      return;

    case "save-as-ritual":
      showAltarToast("Save as Ritual is coming soon");
      return;

    case "send-group-to-grimoire":
      sendCurrentGroupToGrimoire();
      return;

    case "save-altar":

      if (!isUserSignedIn()) {
        shouldSaveAfterAuth = true;
        openSanctuaryModal();
        return;
      }

      saveAltar();
      return;

    case "load-altar":
      loadAltar();
      return;

    case "clear-altar":
      pushAltarUndoSnapshot();
      clearAltar();
      return;

    case "light-all":
      pushAltarUndoSnapshot();

      altarStage
        .querySelectorAll('.altar-object[data-type="candle"]')
        .forEach((candle) => {

          if (candle.dataset.lit === "true") return;

          candle.dataset.lit = "true";
          candle.classList.add("is-lit");
          startFlame(candle);

        });

      return;

        case "extinguish-all":
          pushAltarUndoSnapshot();
    
          altarStage
            .querySelectorAll('.altar-object[data-type="candle"]')
            .forEach((candle) => {
    
              candle.dataset.lit = "false";
              candle.classList.remove("is-lit", "has-flame-glow", "is-flame-glowing");
    
              stopFlame(candle);
              extinguishFlame(candle);
    
              candle.querySelectorAll(".candle-flame, .candle-glow, .flame-glow").forEach((effect) => {
                effect.remove();
              });
    
            });
    
          renderLighting();
    
          return;
  }

});


/* =========================================================
   GLOBAL EVENTS
   ========================================================= */

document.addEventListener("pointerdown", (event) => {

  if (!altarStage) return;

  const clickedObject = event.target.closest(".altar-object");
  const clickedToolbar = event.target.closest(".altar-toolbar");
  const clickedActionBar = event.target.closest(".altar-action-bar");
  const clickedInfoCard = event.target.closest(".altar-info-card");
  const clickedModal = event.target.closest(".altar-cabinet-overlay, .saved-altars-modal, .altar-save-modal");

  if (!clickedObject && !clickedToolbar && !clickedActionBar && !clickedInfoCard && !clickedModal) {

    deselectObject();
    clearCandleDressingMode();

  }

});

});


window.addEventListener("resize", () => {

  requestAnimationFrame(() => {

    repositionAllObjectsFromPercent();

    resizeLightingCanvas();

    renderLighting();

  });

});


/* =========================================================
   MODALS
   ========================================================= */

savedAltarsClose.addEventListener("click", closeSavedAltarsManager);

savedAltarsManager.addEventListener("click", (event) => {
  if (event.target === savedAltarsManager) {
    closeSavedAltarsManager();
    return;
  }

  const button = event.target.closest("[data-saved-action]");
  const row = event.target.closest("[data-saved-altar-id]");

  if (!button || !row) return;

  const altarId = row.dataset.savedAltarId;

  switch (button.dataset.savedAction) {
    case "load":
      loadAltarById(altarId);
      break;

    case "rename":
      renameSavedAltar(altarId);
      break;

    case "delete":
      deleteSavedAltar(altarId);
      break;
  }
});


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener("keydown", (event) => {
  const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z";
  const isRedo =
    (event.metaKey || event.ctrlKey) &&
    (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));

  if (isUndo && !event.shiftKey) {
    event.preventDefault();
    undoAltarChange();
    return;
  }

  if (isRedo) {
    event.preventDefault();
    redoAltarChange();
    return;
  }

  if (event.key === "Escape") {
    closeSanctuaryModal();
    closeSavedAltarsManager();
    closeAltarCabinetOverlay();
    closeAltarApothecaryOverlay();
  }
});


/* =========================================================
   AUTH
   ========================================================= */

document.addEventListener("saltAuthSuccess", async () => {
  closeSanctuaryModal();

  await migrateLocalAltarsToCloud();

  if (shouldSaveAfterAuth) {
    shouldSaveAfterAuth = false;
    await saveAltar();
    showAltarToast("Your altar has been saved");
    return;
  }

  showAltarToast("Signed in");
});


/* =========================================================
   INIT
   ========================================================= */

updateEmptyMessage();
renderCabinet();

resizeLightingCanvas();
renderLighting();


