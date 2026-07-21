/* =========================================================
   RITUAL TEMPLATE SAVE-AND-START BRIDGE
   Templates created from Start Ritual begin immediately after save.
   ========================================================= */

let ritualTemplateShouldStartAfterSave = false;

// Capture the origin before the template editor handles the click.
document.addEventListener(
  "click",
  (event) => {
    const openButton = event.target.closest("[data-open-ritual-template-editor]");
    if (!openButton) return;

    ritualTemplateShouldStartAfterSave = Boolean(
      openButton.closest(".altar-companion-panel")
    );
  },
  true
);

// Closing the editor without saving cancels the pending launch intent.
document.addEventListener(
  "click",
  (event) => {
    const closeButton = event.target.closest("[data-close-ritual-template-editor]");
    const clickedBackdrop =
      typeof ritualTemplateEditorOverlay !== "undefined"
      && ritualTemplateEditorOverlay
      && event.target === ritualTemplateEditorOverlay;

    if (closeButton || clickedBackdrop) {
      ritualTemplateShouldStartAfterSave = false;
    }
  },
  true
);

if (typeof saveRitualTemplateFromEditor === "function") {
  const originalSaveRitualTemplateFromEditor = saveRitualTemplateFromEditor;

  saveRitualTemplateFromEditor = async function saveRitualTemplateAndMaybeStart(form) {
    const templateIdBeforeSave = String(
      new FormData(form).get("template_id") || ""
    );

    const shouldStartAfterSave =
      ritualTemplateShouldStartAfterSave
      && !templateIdBeforeSave
      && !activeRitualSession;

    await originalSaveRitualTemplateFromEditor(form);

    if (!shouldStartAfterSave) return;

    const savedTemplateId = ritualTemplateEditorState.activeTemplateId;
    const savedTemplate = ritualTemplateEditorState.templates.find(
      (template) => template.id === savedTemplateId
    );

    if (!savedTemplate) {
      throw new Error("The template was saved, but it could not be started.");
    }

    ritualTemplateShouldStartAfterSave = false;
    closeRitualTemplateEditor();

    await createTemplateRitualSession(savedTemplate);
    renderActiveRitualPanel();

    if (typeof showAltarToast === "function") {
      showAltarToast("Ritual template saved and started");
    }
  };
}

window.addEventListener("load", () => {
  const script = document.createElement("script");
  script.src = "js/features/ritual-living-library.js";
  script.async = false;
  script.addEventListener("load", async () => {
    const templateId = new URLSearchParams(window.location.search).get("editRitualTemplate");
    if (!templateId || typeof openRitualTemplateEditor !== "function") return;

    await openRitualTemplateEditor(templateId);
    window.history.replaceState({}, "", window.location.pathname);
  });
  document.body.appendChild(script);
});
