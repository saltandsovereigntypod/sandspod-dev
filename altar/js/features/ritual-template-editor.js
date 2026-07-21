/* =========================================================
   RITUAL TEMPLATE EDITOR
   Book of Shadows style editor for reusable ritual templates
   ========================================================= */

let ritualTemplateEditorOverlay = null;
let ritualTemplateEditorState = {
  templates: [],
  altars: [],
  activeTemplateId: null,
  steps: []
};

function ritualTemplateEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createBlankRitualStep() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    title: "",
    instructions: "",
    spoken_text: "",
    duration_minutes: "",
    completion_mode: "manual",
    candle_action_start: "none",
    candle_action_end: "none"
  };
}

function ensureRitualTemplateEditorOverlay() {
  if (ritualTemplateEditorOverlay) return ritualTemplateEditorOverlay;

  ritualTemplateEditorOverlay = document.createElement("div");
  ritualTemplateEditorOverlay.className = "ritual-template-editor-overlay";
  ritualTemplateEditorOverlay.hidden = true;
  ritualTemplateEditorOverlay.innerHTML = `
    <section class="ritual-template-editor" role="dialog" aria-modal="true" aria-labelledby="ritual-template-editor-title">
      <header class="ritual-template-editor-header">
        <div>
          <p class="eyebrow">Book of Shadows</p>
          <h2 id="ritual-template-editor-title">Ritual Templates</h2>
        </div>
        <button class="ritual-template-editor-close" type="button" data-close-ritual-template-editor aria-label="Close">×</button>
      </header>

      <div class="ritual-template-editor-body">
        <aside class="ritual-template-library">
          <div class="ritual-template-library-head">
            <h3>Saved Rituals</h3>
            <button class="ritual-template-new-button" type="button" data-new-ritual-template>+ New</button>
          </div>
          <div class="ritual-template-list" data-ritual-template-library-list></div>
        </aside>

        <div class="ritual-template-form-wrap" data-ritual-template-form-wrap></div>
      </div>
    </section>
  `;

  document.body.appendChild(ritualTemplateEditorOverlay);
  return ritualTemplateEditorOverlay;
}

async function getTemplateEditorUser() {
  if (typeof getRitualUser === "function") return getRitualUser();
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

async function loadRitualTemplateEditorData() {
  const user = await getTemplateEditorUser();
  if (!user) throw new Error("Sign in to create ritual templates.");

  const [{ data: templates, error: templatesError }, { data: altars, error: altarsError }] = await Promise.all([
    db
      .from("ritual_templates")
      .select("*, ritual_template_steps(*)")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    db
      .from("saved_altars")
      .select("id, name, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
  ]);

  if (templatesError) throw templatesError;
  if (altarsError) throw altarsError;

  ritualTemplateEditorState.templates = (templates || []).map((template) => ({
    ...template,
    ritual_template_steps: (template.ritual_template_steps || []).sort((a, b) => a.sort_order - b.sort_order)
  }));
  ritualTemplateEditorState.altars = altars || [];
}

function convertSavedStepForEditor(step) {
  const actions = Array.isArray(step.actions) ? step.actions : [];
  const startAction = actions.find((action) => action.when === "start")?.type || "none";
  const endAction = actions.find((action) => action.when === "end")?.type || "none";

  return {
    id: step.id,
    title: step.title || "",
    instructions: step.instructions || "",
    spoken_text: step.spoken_text || "",
    duration_minutes: step.duration_seconds ? String(step.duration_seconds / 60) : "",
    completion_mode: step.completion_mode || "manual",
    candle_action_start: startAction,
    candle_action_end: endAction
  };
}

function renderRitualTemplateLibrary() {
  const overlay = ensureRitualTemplateEditorOverlay();
  const list = overlay.querySelector("[data-ritual-template-library-list]");
  if (!list) return;

  list.innerHTML = ritualTemplateEditorState.templates.length
    ? ritualTemplateEditorState.templates.map((template) => `
        <button
          type="button"
          class="ritual-template-list-button ${template.id === ritualTemplateEditorState.activeTemplateId ? "is-active" : ""}"
          data-edit-ritual-template="${template.id}">
          <strong>${ritualTemplateEscape(template.title)}</strong>
          <span>${template.ritual_template_steps.length} ${template.ritual_template_steps.length === 1 ? "step" : "steps"}</span>
        </button>
      `).join("")
    : `<p class="ritual-template-empty">No templates yet. Begin a new page.</p>`;
}

function renderRitualTemplateForm(template = null) {
  const overlay = ensureRitualTemplateEditorOverlay();
  const wrap = overlay.querySelector("[data-ritual-template-form-wrap]");
  if (!wrap) return;

  const steps = ritualTemplateEditorState.steps.length
    ? ritualTemplateEditorState.steps
    : [createBlankRitualStep()];
  ritualTemplateEditorState.steps = steps;

  wrap.innerHTML = `
    <form class="ritual-template-form" data-ritual-template-editor-form>
      <input type="hidden" name="template_id" value="${template?.id || ""}" />

      <section class="ritual-template-book-section">
        <h3>The Ritual</h3>
        <p>Write this as you would write it into your own Book of Shadows.</p>

        <div class="ritual-template-grid">
          <label>
            Ritual name
            <input name="title" type="text" required value="${ritualTemplateEscape(template?.title || "")}" placeholder="Deipnon, protection rite, full moon offering..." />
          </label>

          <label>
            Linked altar setup
            <select name="linked_altar_id">
              <option value="">Use the altar as it is</option>
              ${ritualTemplateEditorState.altars.map((altar) => `
                <option value="${altar.id}" ${template?.linked_altar_id === altar.id ? "selected" : ""}>
                  ${ritualTemplateEscape(altar.name)}
                </option>
              `).join("")}
            </select>
          </label>
        </div>

        <label>
          Purpose or intention
          <textarea name="intention" placeholder="What does this ritual hold, honor, release, or invite?">${ritualTemplateEscape(template?.intention || "")}</textarea>
        </label>

        <label>
          Preparation
          <textarea name="preparation" placeholder="Anything to gather, prepare, cleanse, or remember before beginning.">${ritualTemplateEscape(template?.preparation || "")}</textarea>
        </label>
      </section>

      <section class="ritual-template-book-section">
        <h3>Ritual Steps</h3>
        <p>Each step becomes one page of guidance in the Companion panel.</p>
        <div class="ritual-template-steps" data-ritual-template-steps></div>
        <button class="ritual-template-action-button" type="button" data-add-ritual-template-step>+ Add Another Step</button>
      </section>

      <section class="ritual-template-book-section">
        <h3>Closing</h3>
        <p>This appears at the end of the template and is preserved with the ritual.</p>
        <label>
          Closing words or instructions
          <textarea name="closing" placeholder="Ground, give thanks, dispose of offerings, record impressions...">${ritualTemplateEscape(template?.closing || "")}</textarea>
        </label>
      </section>

      <div class="ritual-template-footer-actions">
        <button class="ritual-template-action-button is-primary" type="submit">
          ${template ? "Save Changes" : "Save Ritual Template"}
        </button>
        ${template ? `<button class="ritual-template-action-button is-danger" type="button" data-archive-ritual-template="${template.id}">Archive Template</button>` : ""}
      </div>
      <p class="ritual-template-status" data-ritual-template-status role="status"></p>
    </form>
  `;

  renderRitualTemplateSteps();
}

function renderRitualTemplateSteps() {
  const overlay = ensureRitualTemplateEditorOverlay();
  const target = overlay.querySelector("[data-ritual-template-steps]");
  if (!target) return;

  target.innerHTML = ritualTemplateEditorState.steps.map((step, index) => `
    <article class="ritual-template-step" data-ritual-step-index="${index}">
      <div class="ritual-template-step-head">
        <h4>Step ${index + 1}</h4>
        <div class="ritual-template-step-actions">
          <button class="ritual-template-small-button" type="button" data-move-ritual-step="up" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="ritual-template-small-button" type="button" data-move-ritual-step="down" ${index === ritualTemplateEditorState.steps.length - 1 ? "disabled" : ""}>↓</button>
          <button class="ritual-template-small-button is-danger" type="button" data-remove-ritual-step ${ritualTemplateEditorState.steps.length === 1 ? "disabled" : ""}>Remove</button>
        </div>
      </div>

      <div class="ritual-template-grid">
        <label>
          Step title
          <input data-step-field="title" type="text" required value="${ritualTemplateEscape(step.title)}" placeholder="Open the space" />
        </label>

        <label>
          Completion
          <select data-step-field="completion_mode">
            <option value="manual" ${step.completion_mode === "manual" ? "selected" : ""}>Manual</option>
            <option value="timed" ${step.completion_mode === "timed" ? "selected" : ""}>Automatically after timer</option>
          </select>
        </label>
      </div>

      <label>
        Guidance or instructions
        <textarea data-step-field="instructions" placeholder="What should the practitioner do during this step?">${ritualTemplateEscape(step.instructions)}</textarea>
      </label>

      <label>
        Words to read or speak
        <textarea data-step-field="spoken_text" placeholder="Optional prayer, invocation, petition, affirmation, or spoken words.">${ritualTemplateEscape(step.spoken_text)}</textarea>
      </label>

      <div class="ritual-template-grid">
        <label>
          Timer in minutes
          <input data-step-field="duration_minutes" type="number" min="0" step="0.1" value="${ritualTemplateEscape(step.duration_minutes)}" placeholder="Optional" />
        </label>

        <label>
          When this step begins
          <select data-step-field="candle_action_start">
            <option value="none" ${step.candle_action_start === "none" ? "selected" : ""}>No candle action</option>
            <option value="light_all" ${step.candle_action_start === "light_all" ? "selected" : ""}>Light all candles</option>
            <option value="extinguish_all" ${step.candle_action_start === "extinguish_all" ? "selected" : ""}>Extinguish all candles</option>
          </select>
        </label>

        <label>
          When this step ends
          <select data-step-field="candle_action_end">
            <option value="none" ${step.candle_action_end === "none" ? "selected" : ""}>No candle action</option>
            <option value="light_all" ${step.candle_action_end === "light_all" ? "selected" : ""}>Light all candles</option>
            <option value="extinguish_all" ${step.candle_action_end === "extinguish_all" ? "selected" : ""}>Extinguish all candles</option>
          </select>
        </label>
      </div>
    </article>
  `).join("");
}

function syncRitualTemplateStepFromField(field) {
  const card = field.closest("[data-ritual-step-index]");
  const index = Number(card?.dataset.ritualStepIndex);
  const key = field.dataset.stepField;
  if (!Number.isInteger(index) || !key || !ritualTemplateEditorState.steps[index]) return;
  ritualTemplateEditorState.steps[index][key] = field.value;
}

async function ensureRitualTemplateGrimoirePage(user, templateData, existingPageId = null) {
  if (existingPageId) {
    const { error } = await db
      .from("grimoire_pages")
      .update({
        title: templateData.title,
        page_type: "ritual_template",
        icon: "🌙",
        metadata: {
          ritualTemplateId: templateData.id,
          intention: templateData.intention || "",
          preparation: templateData.preparation || "",
          closing: templateData.closing || ""
        }
      })
      .eq("id", existingPageId)
      .eq("user_id", user.id);
    if (error) throw error;
    return existingPageId;
  }

  let { data: book, error: bookError } = await db
    .from("grimoire_books")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (bookError) throw bookError;

  if (!book) {
    const result = await db
      .from("grimoire_books")
      .insert({ user_id: user.id, title: "Book of Shadows" })
      .select("id")
      .single();
    if (result.error) throw result.error;
    book = result.data;
  }

  let { data: section, error: sectionError } = await db
    .from("grimoire_sections")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", book.id)
    .eq("title", "Ritual Templates")
    .maybeSingle();

  if (sectionError) throw sectionError;

  if (!section) {
    const result = await db
      .from("grimoire_sections")
      .insert({
        user_id: user.id,
        book_id: book.id,
        title: "Ritual Templates",
        sort_order: 0
      })
      .select("id")
      .single();
    if (result.error) throw result.error;
    section = result.data;
  }

  const { data: page, error: pageError } = await db
    .from("grimoire_pages")
    .insert({
      user_id: user.id,
      book_id: book.id,
      section_id: section.id,
      title: templateData.title,
      icon: "🌙",
      page_type: "ritual_template",
      metadata: {
        ritualTemplateId: templateData.id,
        intention: templateData.intention || "",
        preparation: templateData.preparation || "",
        closing: templateData.closing || ""
      }
    })
    .select("id")
    .single();

  if (pageError) throw pageError;
  return page.id;
}

function buildRitualStepActions(step) {
  const actions = [];
  if (step.candle_action_start && step.candle_action_start !== "none") {
    actions.push({ type: step.candle_action_start, when: "start" });
  }
  if (step.candle_action_end && step.candle_action_end !== "none") {
    actions.push({ type: step.candle_action_end, when: "end" });
  }
  return actions;
}

async function saveRitualTemplateFromEditor(form) {
  const user = await getTemplateEditorUser();
  if (!user) throw new Error("Sign in to save this ritual template.");

  const formData = new FormData(form);
  const templateId = String(formData.get("template_id") || "");
  const title = String(formData.get("title") || "").trim();
  const status = form.querySelector("[data-ritual-template-status]");

  if (!title) throw new Error("Name the ritual first.");
  if (!ritualTemplateEditorState.steps.length) throw new Error("Add at least one ritual step.");
  if (ritualTemplateEditorState.steps.some((step) => !String(step.title || "").trim())) {
    throw new Error("Each ritual step needs a title.");
  }

  if (status) status.textContent = "Saving this ritual into your Book of Shadows...";

  const payload = {
    user_id: user.id,
    title,
    intention: String(formData.get("intention") || "").trim() || null,
    preparation: String(formData.get("preparation") || "").trim() || null,
    closing: String(formData.get("closing") || "").trim() || null,
    linked_altar_id: String(formData.get("linked_altar_id") || "") || null,
    estimated_duration_seconds: ritualTemplateEditorState.steps.reduce((sum, step) => {
      return sum + Math.round(Number(step.duration_minutes || 0) * 60);
    }, 0),
    status: "active",
    settings: {},
    metadata: { editorVersion: 1 }
  };

  let savedTemplate;

  if (templateId) {
    const { data, error } = await db
      .from("ritual_templates")
      .update(payload)
      .eq("id", templateId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    savedTemplate = data;
  } else {
    const { data, error } = await db
      .from("ritual_templates")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    savedTemplate = data;
  }

  const existingTemplate = ritualTemplateEditorState.templates.find((item) => item.id === savedTemplate.id);
  const pageId = await ensureRitualTemplateGrimoirePage(
    user,
    savedTemplate,
    existingTemplate?.grimoire_page_id || savedTemplate.grimoire_page_id
  );

  const { error: pageLinkError } = await db
    .from("ritual_templates")
    .update({ grimoire_page_id: pageId })
    .eq("id", savedTemplate.id)
    .eq("user_id", user.id);
  if (pageLinkError) throw pageLinkError;

  if (templateId) {
    const { error } = await db
      .from("ritual_template_steps")
      .delete()
      .eq("template_id", savedTemplate.id)
      .eq("user_id", user.id);
    if (error) throw error;
  }

  const stepRows = ritualTemplateEditorState.steps.map((step, index) => ({
    user_id: user.id,
    template_id: savedTemplate.id,
    sort_order: index,
    title: String(step.title || "").trim(),
    instructions: String(step.instructions || "").trim() || null,
    spoken_text: String(step.spoken_text || "").trim() || null,
    duration_seconds: step.duration_minutes ? Math.round(Number(step.duration_minutes) * 60) : null,
    completion_mode: step.completion_mode || "manual",
    actions: buildRitualStepActions(step),
    linked_entities: [],
    metadata: {}
  }));

  const { error: stepsError } = await db.from("ritual_template_steps").insert(stepRows);
  if (stepsError) throw stepsError;

  if (status) status.textContent = "Ritual template saved.";
  await loadRitualTemplateEditorData();
  ritualTemplateEditorState.activeTemplateId = savedTemplate.id;
  const refreshed = ritualTemplateEditorState.templates.find((item) => item.id === savedTemplate.id);
  ritualTemplateEditorState.steps = (refreshed?.ritual_template_steps || []).map(convertSavedStepForEditor);
  renderRitualTemplateLibrary();
  renderRitualTemplateForm(refreshed);

  if (typeof showAltarToast === "function") showAltarToast("Ritual template saved");
}

async function archiveRitualTemplate(templateId) {
  const user = await getTemplateEditorUser();
  if (!user) return;

  const confirmed = window.confirm("Archive this ritual template?");
  if (!confirmed) return;

  const { error } = await db
    .from("ritual_templates")
    .update({ status: "archived" })
    .eq("id", templateId)
    .eq("user_id", user.id);
  if (error) throw error;

  ritualTemplateEditorState.activeTemplateId = null;
  ritualTemplateEditorState.steps = [createBlankRitualStep()];
  await loadRitualTemplateEditorData();
  renderRitualTemplateLibrary();
  renderRitualTemplateForm();
}

async function openRitualTemplateEditor(templateId = null) {
  const overlay = ensureRitualTemplateEditorOverlay();
  overlay.hidden = false;
  document.body.classList.add("altar-modal-open");

  const wrap = overlay.querySelector("[data-ritual-template-form-wrap]");
  if (wrap) wrap.innerHTML = `<p class="ritual-template-empty">Opening your ritual book...</p>`;

  try {
    await loadRitualTemplateEditorData();
    const template = templateId
      ? ritualTemplateEditorState.templates.find((item) => item.id === templateId)
      : null;

    ritualTemplateEditorState.activeTemplateId = template?.id || null;
    ritualTemplateEditorState.steps = template
      ? template.ritual_template_steps.map(convertSavedStepForEditor)
      : [createBlankRitualStep()];

    renderRitualTemplateLibrary();
    renderRitualTemplateForm(template);
  } catch (error) {
    console.error(error);
    if (wrap) wrap.innerHTML = `<p class="ritual-template-empty">${ritualTemplateEscape(error.message || "The template editor could not be opened.")}</p>`;
  }
}

function closeRitualTemplateEditor() {
  if (!ritualTemplateEditorOverlay) return;
  ritualTemplateEditorOverlay.hidden = true;
  document.body.classList.remove("altar-modal-open");
}

function replaceRitualCreateButtons() {
  document.querySelectorAll("[data-ritual-create-template]").forEach((button) => {
    const replacement = button.cloneNode(true);
    replacement.removeAttribute("data-ritual-create-template");
    replacement.setAttribute("data-open-ritual-template-editor", "");
    button.replaceWith(replacement);
  });
}

const ritualTemplateButtonObserver = new MutationObserver(() => {
  replaceRitualCreateButtons();
});

ritualTemplateButtonObserver.observe(document.body, {
  childList: true,
  subtree: true
});

replaceRitualCreateButtons();

document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-step-field]");
  if (field) syncRitualTemplateStepFromField(field);
});

document.addEventListener("change", (event) => {
  const field = event.target.closest("[data-step-field]");
  if (field) syncRitualTemplateStepFromField(field);
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-ritual-template-editor-form]");
  if (!form) return;

  event.preventDefault();

  try {
    await saveRitualTemplateFromEditor(form);
  } catch (error) {
    console.error(error);
    const status = form.querySelector("[data-ritual-template-status]");
    if (status) status.textContent = error.message || "The ritual template could not be saved.";
  }
});

document.addEventListener("click", async (event) => {
  const openButton = event.target.closest("[data-open-ritual-template-editor]");
  const closeButton = event.target.closest("[data-close-ritual-template-editor]");
  const newButton = event.target.closest("[data-new-ritual-template]");
  const editButton = event.target.closest("[data-edit-ritual-template]");
  const addStepButton = event.target.closest("[data-add-ritual-template-step]");
  const removeStepButton = event.target.closest("[data-remove-ritual-step]");
  const moveStepButton = event.target.closest("[data-move-ritual-step]");
  const archiveButton = event.target.closest("[data-archive-ritual-template]");

  if (openButton) {
    event.preventDefault();
    await openRitualTemplateEditor();
    return;
  }

  if (closeButton || (ritualTemplateEditorOverlay && event.target === ritualTemplateEditorOverlay)) {
    closeRitualTemplateEditor();
    return;
  }

  if (newButton) {
    ritualTemplateEditorState.activeTemplateId = null;
    ritualTemplateEditorState.steps = [createBlankRitualStep()];
    renderRitualTemplateLibrary();
    renderRitualTemplateForm();
    return;
  }

  if (editButton) {
    const template = ritualTemplateEditorState.templates.find((item) => item.id === editButton.dataset.editRitualTemplate);
    if (!template) return;
    ritualTemplateEditorState.activeTemplateId = template.id;
    ritualTemplateEditorState.steps = template.ritual_template_steps.map(convertSavedStepForEditor);
    renderRitualTemplateLibrary();
    renderRitualTemplateForm(template);
    return;
  }

  if (addStepButton) {
    ritualTemplateEditorState.steps.push(createBlankRitualStep());
    renderRitualTemplateSteps();
    return;
  }

  if (removeStepButton) {
    const card = removeStepButton.closest("[data-ritual-step-index]");
    const index = Number(card?.dataset.ritualStepIndex);
    if (Number.isInteger(index) && ritualTemplateEditorState.steps.length > 1) {
      ritualTemplateEditorState.steps.splice(index, 1);
      renderRitualTemplateSteps();
    }
    return;
  }

  if (moveStepButton) {
    const card = moveStepButton.closest("[data-ritual-step-index]");
    const index = Number(card?.dataset.ritualStepIndex);
    const direction = moveStepButton.dataset.moveRitualStep;
    const destination = direction === "up" ? index - 1 : index + 1;

    if (
      Number.isInteger(index)
      && destination >= 0
      && destination < ritualTemplateEditorState.steps.length
    ) {
      const [step] = ritualTemplateEditorState.steps.splice(index, 1);
      ritualTemplateEditorState.steps.splice(destination, 0, step);
      renderRitualTemplateSteps();
    }
    return;
  }

  if (archiveButton) {
    try {
      await archiveRitualTemplate(archiveButton.dataset.archiveRitualTemplate);
    } catch (error) {
      console.error(error);
      if (typeof showAltarToast === "function") showAltarToast("Template could not be archived");
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ritualTemplateEditorOverlay && !ritualTemplateEditorOverlay.hidden) {
    closeRitualTemplateEditor();
  }
});
