/* =========================================================
   EVENTS
   ========================================================= */

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !selectedObject) return;

  if (typeof executeSelectedObjectAction === "function") {
    executeSelectedObjectAction(button.dataset.action, selectedObject);
  }
});


/* =========================================================
   CABINET
   ========================================================= */

function openAltarCabinetOverlay() {
  const overlay = document.querySelector("[data-altar-cabinet-overlay]");
  if (!overlay) return;

  window.clearTimeout(closeAltarCabinetOverlay.timeout);
  overlay.hidden = false;
  overlay.classList.remove("is-closing");
  document.body.classList.add("altar-cabinet-overlay-open");

  requestAnimationFrame(() => {
    overlay.classList.add("is-visible");
  });

  Promise.all([
    typeof loadCustomUserAssets === "function" ? loadCustomUserAssets() : Promise.resolve(),
    typeof loadCustomCabinetItems === "function" ? loadCustomCabinetItems() : Promise.resolve()
  ]).then(() => {
    renderCabinet();
  });
}

function closeAltarCabinetOverlay() {
  const overlay = document.querySelector("[data-altar-cabinet-overlay]");
  if (!overlay) return;

  overlay.classList.remove("is-visible");
  overlay.classList.add("is-closing");
  document.body.classList.remove("altar-cabinet-overlay-open");

  closeAltarCabinetOverlay.timeout = window.setTimeout(() => {
    overlay.hidden = true;
    overlay.classList.remove("is-closing");
  }, 220);
}

function openAltarApothecaryOverlay() {
  const overlay = document.querySelector("[data-altar-apothecary-overlay]");
  if (!overlay) return;

  Promise.all([
    typeof migrateLocalApothecaryToCloud === "function" ? migrateLocalApothecaryToCloud() : Promise.resolve(),
    typeof loadApothecaryItems === "function" ? loadApothecaryItems() : Promise.resolve()
  ]).then(() => {
    if (typeof renderApothecaryItems === "function") {
      renderApothecaryItems();
    }
  });

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
    
    const backgroundButton = event.target.closest("[data-background]");

    if (backgroundButton) {
      changeAltarBackground(backgroundButton);
      return;
    }

  });

  window.AltarCabinetActivation?.createController({
    root: altarCabinet,
    async activate({ item, requestId, pointerId }) {
      try {
        if (!item.dataset.image) {
          if (typeof promptCustomCabinetImage === "function") promptCustomCabinetImage(item);
          else showAltarToast("Add a form image before placing this form");
          return false;
        }

        const placed = placeObject({
          requestId,
          imagePath: item.dataset.image || "",
          fallbackSymbol: item.dataset.object || "",
          label: item.dataset.label || "",
          type: item.dataset.type || "",
          herb: item.dataset.herb || "",
          form: item.dataset.form || "",
          color: item.dataset.color || "",
          crystal: item.dataset.crystal || "",
          tool: item.dataset.tool || "",
          vessel: item.dataset.vessel || "",
          deity: item.dataset.deity || "",
          entityId: item.dataset.entityId || ""
        });
        if (!placed) throw new Error("placement_rejected");
        closeAltarCabinetOverlay();
        return true;
      } catch (error) {
        console.warn("Cabinet placement failed.", { code: "placement_failed" });
        showAltarToast("That item could not be placed. Please try again.");
        return false;
      } finally {
        if (pointerId != null && item.hasPointerCapture?.(pointerId)) item.releasePointerCapture(pointerId);
        if (typeof resetAltarPointerState === "function") resetAltarPointerState();
      }
    }
  });
}

document.addEventListener("click", (event) => {
  const openCabinetButton = event.target.closest("[data-open-cabinet-overlay]");
  const closeCabinetButton = event.target.closest("[data-close-cabinet-overlay]");
  const openApothecaryButton = event.target.closest("[data-open-apothecary-overlay]");
  const closeApothecaryButton = event.target.closest("[data-close-apothecary-overlay]");

  const addCustomCabinetItemButton = event.target.closest("[data-add-custom-cabinet-item]");
  const editCustomCabinetItemButton = event.target.closest("[data-edit-custom-cabinet-item]");
  const closeCustomCabinetItemButton = event.target.closest("[data-close-custom-cabinet-item]");
  const deleteCustomCabinetItemButton = event.target.closest("[data-delete-custom-cabinet-item]");
  const createAllRemainingFormsButton = event.target.closest("[data-create-all-remaining-forms]");
  const openLibraryEntityButton = event.target.closest("[data-open-library-entity]");
  const openLivingHistoryButton = event.target.closest("[data-open-living-history]");
  const manageRelationshipsButton = event.target.closest("[data-manage-library-relationships]");
  const closeRelationshipManagerButton = event.target.closest("[data-close-relationship-manager]");
  const deleteLibraryRelationshipButton = event.target.closest("[data-delete-library-relationship]");
  const editLibraryRelationshipButton = event.target.closest("[data-edit-library-relationship]");
  const cancelLibraryRelationshipButton = event.target.closest("[data-cancel-library-relationship]");
  const cleanupLibraryRelationshipsButton = event.target.closest("[data-cleanup-library-relationships]");
  const closeLivingHistoryButton = event.target.closest("[data-close-living-history]");

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

  if (addCustomCabinetItemButton) {
  event.preventDefault();

    if (typeof openCustomCabinetItemModal === "function") {
      openCustomCabinetItemModal();
    }

    return;
  }

    if (editCustomCabinetItemButton) {

      event.preventDefault();

      event.stopPropagation();

      if (typeof openCustomCabinetItemModal === "function") {

        openCustomCabinetItemModal(
          editCustomCabinetItemButton.dataset.editCustomCabinetItem,
          editCustomCabinetItemButton.dataset.focusCustomForm || ""
        );

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

  if (closeCustomCabinetItemButton) {
    event.preventDefault();

    if (typeof closeCustomCabinetItemModal === "function") {
      closeCustomCabinetItemModal();
    }

    return;
  }

  if (createAllRemainingFormsButton) {
    event.preventDefault();

    const modal = createAllRemainingFormsButton.closest("[data-custom-cabinet-item-modal]");
    if (!modal) return;

    modal.querySelectorAll(".custom-form-upload-row input[type='checkbox'][name^='form_enabled_']").forEach((checkbox) => {
      checkbox.checked = true;
    });

    showAltarToast("Remaining forms selected");
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

  if (openLibraryEntityButton) {
    event.preventDefault();

    if (typeof showLibraryEntityInCompanion === "function") {
      showLibraryEntityInCompanion(openLibraryEntityButton.dataset.openLibraryEntity);
    }

    return;
  }

  if (openLivingHistoryButton) {
    event.preventDefault();

    if (typeof openLivingHistoryModal === "function") {
      openLivingHistoryModal(openLivingHistoryButton.dataset.openLivingHistory);
    }

    return;
  }

  if (closeLivingHistoryButton) {
    event.preventDefault();

    if (typeof closeLivingHistoryModal === "function") {
      closeLivingHistoryModal();
    }

    return;
  }

  if (manageRelationshipsButton) {
    event.preventDefault();

    if (typeof openRelationshipManagerModal === "function") {
      openRelationshipManagerModal(manageRelationshipsButton.dataset.manageLibraryRelationships);
    }

    return;
  }

  if (closeRelationshipManagerButton) {
    event.preventDefault();

    if (typeof closeRelationshipManagerModal === "function") {
      closeRelationshipManagerModal();
    }

    return;
  }

  if (deleteLibraryRelationshipButton) {
    event.preventDefault();

    if (typeof deleteLibraryRelationship === "function") {
      deleteLibraryRelationship(deleteLibraryRelationshipButton.dataset.deleteLibraryRelationship);
    }

    return;
  }

  if (editLibraryRelationshipButton) {
    event.preventDefault();
    editLibraryRelationship(editLibraryRelationshipButton.dataset.editLibraryRelationship);
  }

  if (cancelLibraryRelationshipButton) {
    event.preventDefault();
    const modal = cancelLibraryRelationshipButton.closest("[data-relationship-manager-modal]");
    refreshRelationshipManagerModal(modal?.dataset.entityId || "");
  }

  if (cleanupLibraryRelationshipsButton) {
    event.preventDefault();
    cleanupExactLibraryRelationships();
  }
});

window.AltarPlacement = {
  placeCabinetItem(request) { return window.AltarCabinet?.placeItem?.(request) || false; },
  placeApothecaryItem(itemId) { return typeof placeApothecaryItem === "function" ? placeApothecaryItem(itemId) : false; },
  selectInstance(instanceId) {
    const object = [...document.querySelectorAll(".altar-object")].find((item) => item.dataset.altarObjectId === instanceId || item.dataset.instanceId === instanceId);
    if (!object || typeof selectObject !== "function") return false;
    selectObject(object);
    return true;
  }
};

function consumeAltarSearchAction(names) {
  const url = new URL(window.location.href);
  names.forEach((name) => url.searchParams.delete(name));
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  window.setTimeout(async () => {
    const cabinetItemId = params.get("placeCabinetItem");
    if (cabinetItemId) {
      const placed = window.AltarPlacement.placeCabinetItem({ itemId: cabinetItemId, formId: params.get("form") || "" });
      if (placed) consumeAltarSearchAction(["placeCabinetItem", "form"]);
    }
    const placeApothecaryItemId = params.get("placeApothecaryItem");
    if (placeApothecaryItemId) {
      if (typeof loadApothecaryItems === "function") await loadApothecaryItems();
      if (window.AltarPlacement.placeApothecaryItem(placeApothecaryItemId)) consumeAltarSearchAction(["placeApothecaryItem"]);
    }
    const apothecaryItemId = params.get("apothecaryItem");
    if (apothecaryItemId && typeof openApothecaryItemEditor === "function") openApothecaryItemEditor(apothecaryItemId);
    const instanceId = params.get("selectObject");
    if (instanceId && typeof selectObject === "function") {
      const object = [...document.querySelectorAll(".altar-object")].find((item) => item.dataset.altarObjectId === instanceId || item.dataset.instanceId === instanceId);
      if (object) selectObject(object);
    }
  }, 0);
}, { once: true });

document.addEventListener("change", (event) => {
  const categorySelect = event.target.closest("[data-custom-cabinet-category-select]");
  if (!categorySelect) return;

  const modal = categorySelect.closest("[data-custom-cabinet-item-modal]");
  const formFields = modal?.querySelector("[data-custom-form-upload-fields]");

  if (!formFields || typeof renderCustomFormUploadFields !== "function") return;

  formFields.innerHTML = renderCustomFormUploadFields(categorySelect.value, []);
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
          startLivingCandleBurn(candle);
        });

      renderLighting();
      saveWorkingAltarDraft();
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
          stopLivingCandleBurn(candle);

          candle.querySelectorAll(".candle-flame, .candle-glow, .flame-glow").forEach((effect) => {
            effect.remove();
          });
        });

      renderLighting();
      saveWorkingAltarDraft();
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
  const addLibraryRelationshipForm = event.target.closest("[data-add-library-relationship]");
  const updateLibraryRelationshipForm = event.target.closest("[data-update-library-relationship]");
  const mergeLibraryEntityForm = event.target.closest("[data-merge-library-entity]");

  if (
    !customCabinetItemForm &&
    !addLibraryRelationshipForm &&
    !updateLibraryRelationshipForm &&
    !mergeLibraryEntityForm
  ) {
    return;
  }

  event.preventDefault();

  if (customCabinetItemForm) {
    if (typeof saveCustomCabinetItem === "function") {
      await saveCustomCabinetItem(customCabinetItemForm);
    }

    return;
  }

  if (addLibraryRelationshipForm) {
    if (typeof addLibraryRelationshipFromForm === "function") {
      addLibraryRelationshipFromForm(addLibraryRelationshipForm);
    }

    return;
  }

  if (updateLibraryRelationshipForm) {
    if (typeof updateLibraryRelationshipFromForm === "function") {
      updateLibraryRelationshipFromForm(updateLibraryRelationshipForm);
    }

    return;
  }

  if (mergeLibraryEntityForm) {
    if (typeof mergeLibraryEntityFromForm === "function") {
      mergeLibraryEntityFromForm(mergeLibraryEntityForm);
    }

    return;
  }
});

/* =========================================================
   GLOBAL EVENTS
   ========================================================= */

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
