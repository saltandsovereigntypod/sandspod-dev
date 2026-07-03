/* =========================================================
   EVENTS
   ========================================================= */

let toolbarHoldInterval = null;
let toolbarHoldTimeout = null;

function stopToolbarHoldAction() {
  window.clearTimeout(toolbarHoldTimeout);
  window.clearInterval(toolbarHoldInterval);

  toolbarHoldTimeout = null;
}

function startToolbarHoldAction(action) {
  stopToolbarHoldAction();

  if (!selectedObject) return;

  const holdActions = {
    smaller: () => resizeObject(selectedObject, -0.04),
    larger: () => resizeObject(selectedObject, 0.04),
    "rotate-left": () => rotateObject(selectedObject, -3),
    "rotate-right": () => rotateObject(selectedObject, 3)
  };

  const holdAction = holdActions[action];

  if (!holdAction) return;

  toolbarHoldTimeout = window.setTimeout(() => {
    pushAltarUndoSnapshot();

    toolbarHoldInterval = window.setInterval(() => {
      if (!selectedObject) {
        stopToolbarHoldAction();
        return;
      }

      holdAction();
      updateObjectPositionPercent(selectedObject);
    }, 70);
  }, 280);
}

toolbar.addEventListener("pointerdown", (event) => {
  event.stopPropagation();

  const button = event.target.closest("button");
  if (!button || !selectedObject) return;

  event.preventDefault();

  startToolbarHoldAction(button.dataset.action);
});

toolbar.addEventListener("pointerup", stopToolbarHoldAction);
toolbar.addEventListener("pointercancel", stopToolbarHoldAction);
toolbar.addEventListener("pointerleave", stopToolbarHoldAction);

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !selectedObject) return;

  stopToolbarHoldAction();

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

      renderLighting();
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
