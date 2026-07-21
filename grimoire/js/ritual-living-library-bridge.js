/* =========================================================
   RITUAL LIVING LIBRARY BRIDGE
   Adds ritual templates to My Practice and routes editing to the altar editor.
   ========================================================= */

if (Array.isArray(MY_PRACTICE_TYPES) && !MY_PRACTICE_TYPES.includes("ritual_template")) {
  const ritualIndex = MY_PRACTICE_TYPES.indexOf("ritual");
  MY_PRACTICE_TYPES.splice(ritualIndex >= 0 ? ritualIndex + 1 : MY_PRACTICE_TYPES.length, 0, "ritual_template");
}

if (typeof getMyPracticeTypeLabel === "function") {
  const originalGetMyPracticeTypeLabel = getMyPracticeTypeLabel;
  getMyPracticeTypeLabel = function(type = "") {
    if (type === "ritual_template") return "Templates";
    return originalGetMyPracticeTypeLabel(type);
  };
}

function addRitualTemplateEditButton() {
  if (typeof Library === "undefined" || !activeLibraryEntityId) return;

  const entity = Library.getEntity(activeLibraryEntityId);
  if (!entity || entity.type !== "ritual_template") return;

  const target = document.querySelector("[data-entry-list]");
  if (!target || target.querySelector("[data-edit-ritual-template-from-library]")) return;

  const templateId = entity.metadata?.ritualTemplateId || entity.myPractice?.RitualTemplateId;
  if (!templateId) return;

  const actions = document.createElement("div");
  actions.className = "altar-info-card-actions";
  actions.innerHTML = `
    <button type="button" class="button button--primary" data-edit-ritual-template-from-library="${templateId}">
      Edit Ritual Template
    </button>
  `;
  target.prepend(actions);
}

const ritualLibraryObserver = new MutationObserver(() => {
  addRitualTemplateEditButton();
});

ritualLibraryObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-ritual-template-from-library]");
  if (!button) return;

  event.preventDefault();
  const templateId = button.dataset.editRitualTemplateFromLibrary;
  window.location.href = `../altar/index.html?editRitualTemplate=${encodeURIComponent(templateId)}`;
});

addRitualTemplateEditButton();
