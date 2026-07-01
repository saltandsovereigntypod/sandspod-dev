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
      resizeObject(selectedObject, -0.1);
      break;

    case "larger":
      resizeObject(selectedObject, 0.1);
      break;

    case "rotate":
      rotateObject(selectedObject);
      break;

    case "delete":
      deleteObject(selectedObject);
      break;

    case "forward":
      bringForward(selectedObject);
      break;

    case "backward":
      sendBackward(selectedObject);
      break;

    case "flip":
      flipObject(selectedObject);
      break;

    case "lock":
      toggleLock(selectedObject);
      break;

    case "duplicate":
      duplicateObject(selectedObject);
      break;

    case "glow":
      toggleGlow(selectedObject);
      break;

    case "light":
      toggleLight(selectedObject);
      break;

    case "dress-candle":
      beginCandleDressing(selectedObject);
      break;
  }
});


/* =========================================================
   CABINET
   ========================================================= */

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

      if (window.innerWidth <= 700) {
        closeMobileCabinet();
      }

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

    if (window.innerWidth <= 700) {
      closeMobileCabinet();
    }
  });
}


/* =========================================================
   ACTION BAR
   ========================================================= */

altarActionBar.addEventListener("click", (event) => {

  const button = event.target.closest("[data-global-action]");

  if (!button || !altarStage) return;

  switch (button.dataset.globalAction) {

    case "select-ritual-items":
      toggleRitualSelectionMode();
      return;

    case "group-ritual-items":
      groupSelectedRitualItems();
      return;

    case "ungroup-ritual-items":
      ungroupCurrentItems();
      return;

    case "send-group-to-grimoire":
      sendCurrentGroupToGrimoire();
      return;

    case "save-altar":

      if (!isUserSignedIn()) {
        shouldSaveAfterAuth = true;
        openSaveModal();
        return;
      }

      saveAltar();
      return;

    case "load-altar":
      loadAltar();
      return;

    case "clear-altar":
      clearAltar();
      return;

    case "light-all":

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

      altarStage
        .querySelectorAll('.altar-object[data-type="candle"]')
        .forEach((candle) => {

          if (candle.dataset.lit !== "true") return;

          candle.dataset.lit = "false";
          candle.classList.remove("is-lit");

          stopFlame(candle);
          extinguishFlame(candle);

        });

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

  if (!clickedObject && !clickedToolbar && !clickedActionBar) {

    deselectObject();
    clearCandleDressingMode();

  }

});


window.addEventListener("resize", () => {

  requestAnimationFrame(repositionAllObjectsFromPercent);

});


/* =========================================================
   MODALS
   ========================================================= */

if (saveModalClose) {

  saveModalClose.addEventListener("click", closeSaveModal);

}

if (saveModal) {

  saveModal.addEventListener("click", (event) => {

    if (event.target === saveModal) {
      closeSaveModal();
    }

  });

}

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

  if (event.key === "Escape") {

    closeSaveModal();
    closeSavedAltarsManager();

  }

});


/* =========================================================
   AUTH
   ========================================================= */

document.addEventListener("saltAuthSuccess", async () => {

  closeSaveModal();

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
