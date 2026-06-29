/* =========================================================
   GRIMOIRE EVENTS
   File: grimoire/js/events.js
   ========================================================= */

if (entrySearch) {
  entrySearch.addEventListener("input", () => {
    searchTerm = entrySearch.value;
    applySearch();
  });
}

if (editToggleButton) {
  editToggleButton.addEventListener("click", async () => {
    if (!currentPage) return;

    if (pageMode === "edit") {
      try {
        await saveAllVisibleEdits();
        pageMode = "read";
        updateEditButton();
        renderReader();
        flashStatus("Saved.");
      } catch (error) {
        console.error("Could not save page:", error);
        setStatus(error.message || "This page could not be saved.");
      }

      return;
    }

    pageMode = "edit";
    updateEditButton();
    renderEditor();
  });
}

document.addEventListener("click", async (event) => {
  const createSectionButton = event.target.closest("[data-create-section]");
  const createPageButton = event.target.closest("[data-create-page]");
  const toggleSectionButton = event.target.closest("[data-toggle-section]");
  const pageButton = event.target.closest("[data-page-id]");

  const addBlockButton = event.target.closest("[data-add-block-type]");
  const deleteBlockButton = event.target.closest("[data-delete-block]");
  const moveUpButton = event.target.closest("[data-move-block-up]");
  const moveDownButton = event.target.closest("[data-move-block-down]");

  const moveSectionUpButton = event.target.closest("[data-move-section-up]");
  const moveSectionDownButton = event.target.closest("[data-move-section-down]");
  const movePageUpButton = event.target.closest("[data-move-page-up]");
  const movePageDownButton = event.target.closest("[data-move-page-down]");

  const ashesButton = event.target.closest("[data-return-page-to-ashes]");
  const doneButton = event.target.closest("[data-done-editing]");
  const templateButton = event.target.closest("[data-open-template-menu]");
  const linkPageButton = event.target.closest("[data-link-existing-page]");
  const choosePageForBlockButton = event.target.closest("[data-choose-page-for-block]");

  const chooseTemplateButton = event.target.closest("[data-choose-template]");
  const choosePageButton = event.target.closest("[data-choose-page]");
  const richButton = event.target.closest("[data-rich-command]");
  const closeModalButton = event.target.closest("[data-close-book-modal]");

  if (createSectionButton) {
    createSection();
    return;
  }

  if (createPageButton) {
    createPage();
    return;
  }

  if (toggleSectionButton) {
    toggleSection(toggleSectionButton.dataset.toggleSection);
    return;
  }

  if (moveSectionUpButton) {
    moveSection(moveSectionUpButton.dataset.moveSectionUp, "up");
    return;
  }

  if (moveSectionDownButton) {
    moveSection(moveSectionDownButton.dataset.moveSectionDown, "down");
    return;
  }

  if (movePageUpButton) {
    movePageInSection(movePageUpButton.dataset.movePageUp, "up");
    return;
  }

  if (movePageDownButton) {
    movePageInSection(movePageDownButton.dataset.movePageDown, "down");
    return;
  }

  if (pageButton) {
    await openPage(pageButton.dataset.pageId, "read");
    return;
  }

  if (addBlockButton) {
    createElement(addBlockButton.dataset.addBlockType);
    return;
  }

  if (deleteBlockButton) {
    deleteBlock(deleteBlockButton.dataset.deleteBlock);
    return;
  }

  if (moveUpButton) {
    moveBlock(moveUpButton.dataset.moveBlockUp, "up");
    return;
  }

  if (moveDownButton) {
    moveBlock(moveDownButton.dataset.moveBlockDown, "down");
    return;
  }

  if (ashesButton) {
    returnCurrentPageToAshes();
    return;
  }

  if (doneButton) {
    try {
      await saveAllVisibleEdits();
      pageMode = "read";
      updateEditButton();
      renderReader();
      flashStatus("Saved.");
    } catch (error) {
      console.error("Could not finish editing:", error);
      setStatus(error.message || "This page could not be saved.");
    }

    return;
  }

  if (templateButton) {
    applyTemplateToCurrentPage();
    return;
  }

  if (linkPageButton) {
    linkExistingPage();
    return;
  }

  if (choosePageForBlockButton) {
    choosePageForBlock(choosePageForBlockButton.dataset.choosePageForBlock);
    return;
  }

  if (richButton) {
    runRichCommand(richButton.dataset.richCommand);
    return;
  }

  if (chooseTemplateButton) {
    closeBookModal(chooseTemplateButton.dataset.chooseTemplate);
    return;
  }

  if (choosePageButton) {
    const page = pages.find((item) => item.id === choosePageButton.dataset.choosePage);
    closeBookModal(page || null);
    return;
  }

  if (closeModalButton) {
    if (event.target === closeModalButton || closeModalButton.tagName === "BUTTON") {
      closeBookModal(null);
    }
  }
});

document.addEventListener("focusin", (event) => {
  const richInput = event.target.closest("[data-rich-input]");

  if (richInput) {
    activeRichEditor = richInput;
  }
});

document.addEventListener("input", (event) => {
  const blockInput = event.target.closest("[data-block-input]");
  const metadataInput = event.target.closest("[data-block-metadata-input]");
  const titleInput = event.target.closest("[data-page-title-input]");

  if (blockInput) {
    const isRich = blockInput.hasAttribute("contenteditable");
    const metadataField = blockInput.dataset.metadataField;

    if (metadataField) {
      debounceSave(`${blockInput.dataset.blockId}-${metadataField}`, () => {
        saveBlockMetadata(blockInput.dataset.blockId, metadataField, blockInput.value);
      });
      return;
    }

    debounceSave(blockInput.dataset.blockId, () => {
      const value = isRich ? blockInput.innerHTML : blockInput.value;
      saveBlock(blockInput.dataset.blockId, value, isRich);
    });
  }

  if (metadataInput) {
    debounceSave(`${metadataInput.dataset.blockId}-${metadataInput.dataset.metadataField}`, () => {
      saveBlockMetadata(
        metadataInput.dataset.blockId,
        metadataInput.dataset.metadataField,
        metadataInput.value
      );
    });
  }

  if (titleInput) {
    debounceSave("page-title", saveCurrentPageTitle);
  }
});

if (mundaneToggle) {
  mundaneToggle.checked = mundaneMode;

  mundaneToggle.addEventListener("change", () => {
    mundaneMode = mundaneToggle.checked;
    localStorage.setItem("saltMundaneMode", String(mundaneMode));
    updateMundaneModeUI();
  });
}

document.addEventListener("saltAuthChanged", updateAuthState);
document.addEventListener("saltAuthSuccess", updateAuthState);
