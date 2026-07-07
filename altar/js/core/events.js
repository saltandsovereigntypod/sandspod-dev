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

  if (typeof renderApothecaryItems === "function") {
    renderApothecaryItems();
  }

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
    
    const uploadCabinetImageButton = event.target.closest("[data-upload-cabinet-image]");
    const restoreCabinetImageButton = event.target.closest("[data-restore-cabinet-image]");
    const addCustomBackgroundButton = event.target.closest("[data-add-custom-background]");
    const deleteCustomBackgroundButton = event.target.closest("[data-delete-custom-background]");

    if (uploadCabinetImageButton) {
      event.preventDefault();
      event.stopPropagation();

      const tile = uploadCabinetImageButton.closest("[data-image]");
      if (tile && typeof promptCustomCabinetImage === "function") {
        promptCustomCabinetImage(tile);
      }

      return;
    }

    if (restoreCabinetImageButton) {
      event.preventDefault();
      event.stopPropagation();

      const tile = restoreCabinetImageButton.closest("[data-image]");
      if (tile && typeof restoreDefaultCabinetImage === "function") {
        restoreDefaultCabinetImage(tile);
      }

      return;
    }

    if (addCustomBackgroundButton) {
      event.preventDefault();

      if (typeof promptCustomAltarBackground === "function") {
        promptCustomAltarBackground();
      }

      return;
    }

    if (deleteCustomBackgroundButton) {
      event.preventDefault();
      event.stopPropagation();

      if (typeof deleteCustomAltarBackground === "function") {
        deleteCustomAltarBackground(deleteCustomBackgroundButton.dataset.deleteCustomBackground);
      }

      return;
    }

    const addCustomCabinetItemButton = event.target.closest("[data-add-custom-cabinet-item]");
    const closeCustomCabinetItemButton = event.target.closest("[data-close-custom-cabinet-item]");
    const customCabinetItemForm = event.target.closest("[data-custom-cabinet-item-form]");
    const deleteCustomCabinetItemButton = event.target.closest("[data-delete-custom-cabinet-item]");

    if (addCustomCabinetItemButton) {
      event.preventDefault();

      if (typeof openCustomCabinetItemModal === "function") {
        openCustomCabinetItemModal();
      }

      return;
    }

    if (closeCustomCabinetItemButton) {
      event.preventDefault();

      if (typeof closeCustomCabinetItemModal === "function") {
        closeCustomCabinetItemModal();
      }

      return;
    }

    if (deleteCustomCabinetItemButton) {
      event.preventDefault();
      event.stopPropagation();

      if (typeof deleteCustomCabinetItem === "function") {
        deleteCustomCabinetItem(deleteCustomCabinetItemButton.dataset.deleteCustomCabinetItem);
      }

      return;
    }
    
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
      deity: itemButton.dataset.deity || "",
      entityId: itemButton.dataset.entityId || "",
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
      openGroupCreationChoiceModal();
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
   LIVING STATE ACTIONS
   ========================================================= */

document.addEventListener("click", (event) => {
  const practiceButton = event.target.closest("[data-living-state-practice]");
  const practiceCloseButton = event.target.closest("[data-living-state-practice-close]");
  const practiceModal = event.target.closest("[data-living-state-practice-modal]");
  const activityChoice = event.target.closest("[data-living-state-activity-choice]");

  const tendButton = event.target.closest("[data-living-state-tend]");
  const closeTendButton = event.target.closest("[data-living-state-tend-close]");
  const tendModal = event.target.closest("[data-living-state-tend-modal]");

  const closeActivityButton = event.target.closest("[data-living-state-activity-close]");
  const activityModal = event.target.closest("[data-living-state-activity-modal]");

  if (practiceButton) {
    event.preventDefault();
    openLivingStatePracticeMenu();
  }

  if (practiceCloseButton) {
    event.preventDefault();
    closeLivingStatePracticeMenu();
  }

  if (practiceModal && event.target === practiceModal) {
    closeLivingStatePracticeMenu();
  }

  if (activityChoice) {
    event.preventDefault();

    const activityType = activityChoice.dataset.livingStateActivityChoice;

    closeLivingStatePracticeMenu();

    if (activityType === "tend") {
      openLivingStateTendModal();
      return;
    }

    openLivingStateActivityModal(activityType);
  }

  if (tendButton) {
    event.preventDefault();
    openLivingStateTendModal();
  }

  if (closeTendButton) {
    event.preventDefault();
    closeLivingStateTendModal();
  }

  if (tendModal && event.target === tendModal) {
    closeLivingStateTendModal();
  }

  if (closeActivityButton) {
    event.preventDefault();
    closeLivingStateActivityModal();
  }

  if (activityModal && event.target === activityModal) {
    closeLivingStateActivityModal();
  }
});

document.addEventListener("submit", async (event) => {
  const tendForm = event.target.closest("[data-living-state-tend-form]");
  const activityForm = event.target.closest("[data-living-state-activity-form]");

  if (!tendForm && !activityForm) return;

  event.preventDefault();

  if (tendForm) {
    await submitLivingStateTendForm(tendForm);
  }

  if (activityForm) {
    await submitLivingStateActivityForm(activityForm);
  }
});

document.addEventListener("submit", async (event) => {
  const customCabinetItemForm = event.target.closest("[data-custom-cabinet-item-form]");
  if (!customCabinetItemForm) return;

  event.preventDefault();

  if (typeof saveCustomCabinetItem === "function") {
    await saveCustomCabinetItem(customCabinetItemForm);
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
  const clickedCompanionPanel = event.target.closest(".altar-companion-panel");
  const clickedModal = event.target.closest(".altar-cabinet-overlay, .saved-altars-modal, .altar-save-modal, .living-state-tend-modal");

  if (!clickedObject && !clickedToolbar && !clickedActionBar && !clickedInfoCard && !clickedCompanionPanel && !clickedModal) {
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

    if (typeof closeLivingStateTendModal === "function") {
      closeLivingStateTendModal();
    }

    if (typeof closeLivingStateActivityModal === "function") {
      closeLivingStateActivityModal();
    }

    if (typeof closeLivingStatePracticeMenu === "function") {
      closeLivingStatePracticeMenu();
    }

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

window.setTimeout(() => {
  if (typeof restoreWorkingAltarDraft === "function") {
    restoreWorkingAltarDraft();
  }
}, 500);

/* =========================================================
   MOBILE / UNIVERSAL SELECTION LOCK
   Only the Done button deselects altar objects
   ========================================================= */

function getSelectedAltarObjectElement() {
  return document.querySelector(".altar-object.is-selected");
}

function intentionallyDeselectAltarObject() {
  const selected = getSelectedAltarObjectElement();

  if (selected) {
    selected.classList.remove("is-selected", "is-dragging");
  }

  try {
    if (typeof selectedObject !== "undefined") selectedObject = null;
  } catch {}

  try {
    if (typeof activeObject !== "undefined") activeObject = null;
  } catch {}

  const toolbar = document.querySelector(".altar-toolbar");
  if (toolbar) {
    toolbar.hidden = true;
  }

  const companion = document.querySelector(".altar-companion-panel");
  if (companion) {
    companion.classList.remove("is-visible");
  }

  document.body.classList.remove("altar-object-selected");
}

function ensureDeselectButton() {
  const toolbar = document.querySelector(".altar-toolbar");

  if (!toolbar) return;
  if (toolbar.querySelector("[data-deselect-object]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "altar-toolbar-done";
  button.setAttribute("data-deselect-object", "");
  button.setAttribute("aria-label", "Deselect object");
  button.textContent = "✓";

  toolbar.appendChild(button);
}

document.addEventListener("click", (event) => {
  const doneButton = event.target.closest("[data-deselect-object]");

  if (doneButton) {
    event.preventDefault();
    event.stopPropagation();
    intentionallyDeselectAltarObject();
    return;
  }
});

document.addEventListener(
  "click",
  (event) => {
    const stage = event.target.closest("[data-altar-stage]");
    const selected = getSelectedAltarObjectElement();

    if (!stage || !selected) return;

    const clickedObject = event.target.closest(".altar-object");
    const clickedToolbar = event.target.closest(".altar-toolbar");
    const clickedCompanion = event.target.closest(".altar-companion-panel");
    const clickedCabinet = event.target.closest(".altar-cabinet-overlay, .living-state-tend-modal");

    if (clickedObject || clickedToolbar || clickedCompanion || clickedCabinet) return;

    event.stopImmediatePropagation();
  },
  true
);

const altarSelectionObserver = new MutationObserver(() => {
  ensureDeselectButton();

  const selected = getSelectedAltarObjectElement();
  document.body.classList.toggle("altar-object-selected", Boolean(selected));
});

altarSelectionObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"]
});

ensureDeselectButton();

/* =========================================================
   MOBILE COMPANION PANEL TOGGLE
   ========================================================= */

document.addEventListener("click", (event) => {
  const companionButton = event.target.closest(
    "[data-companion-mobile-toggle], .altar-companion-header button"
  );

  if (!companionButton) return;

  event.preventDefault();
  event.stopPropagation();

  document.body.classList.toggle("altar-companion-mobile-minimized");

  companionButton.textContent = document.body.classList.contains("altar-companion-mobile-minimized")
    ? "+"
    : "−";
});

/* =========================================================
   LIVING LIBRARY STARTUP
   ========================================================= */

document.addEventListener("saltAuthReady", () => {
  if (typeof Library !== "undefined" && typeof Library.importTraditionalLibrary === "function") {
    Library.importTraditionalLibrary();
  }

  if (typeof initLivingLibrarySupabaseSync === "function") {
    initLivingLibrarySupabaseSync();
  }
});

document.addEventListener("saltAuthSuccess", () => {
  if (typeof initLivingLibrarySupabaseSync === "function") {
    initLivingLibrarySupabaseSync();
  }
});