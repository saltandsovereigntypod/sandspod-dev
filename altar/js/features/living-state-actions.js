/* =========================================================
   LIVING STATE ACTIONS
   Tend, record, and update object manifestations
   ========================================================= */

function escapeLivingStateHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addDaysFromNowForLivingState(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 30));
  return date.toISOString();
}

function getLivingStateCabinetChoices() {
  if (typeof cabinetItems === "undefined") return [];

  return cabinetItems
    .filter((item) => item.category !== "backgrounds")
    .flatMap((item) => {
      return (item.forms || []).map((form) => ({
        source: "cabinet",
        label: `${item.name} ${form.label || ""}`.trim(),
        type: form.type || item.category || "",
        form: form.form || "",
        entityName: form.herb || form.crystal || form.tool || form.vessel || form.deity || form.color || item.name
      }));
    });
}

function getLivingStateApothecaryChoices() {
  if (typeof getApothecaryItems !== "function") return [];

  return getApothecaryItems().map((item) => ({
    source: "apothecary",
    label: item.name,
    type: item.typeLabel || item.type || "Apothecary Item",
    itemId: item.id,
    entityId: item.entityId || "",
    instanceId: item.instanceId || ""
  }));
}

function renderLivingStateChoice(choice, index) {
  return `
    <label class="living-state-choice">
      <input
        type="checkbox"
        data-tend-choice
        data-tend-source="${escapeLivingStateHtml(choice.source)}"
        data-tend-label="${escapeLivingStateHtml(choice.label)}"
        data-tend-type="${escapeLivingStateHtml(choice.type)}"
        data-tend-entity-id="${escapeLivingStateHtml(choice.entityId || "")}"
        data-tend-instance-id="${escapeLivingStateHtml(choice.instanceId || "")}"
        data-tend-item-id="${escapeLivingStateHtml(choice.itemId || "")}"
      />
      <span>${escapeLivingStateHtml(choice.label)}</span>
      <small>${escapeLivingStateHtml(choice.source)}${choice.type ? ` · ${escapeLivingStateHtml(choice.type)}` : ""}</small>
    </label>
  `;
}

function openLivingStateTendModal() {
  if (!selectedObject?.dataset.instanceId) {
    showAltarToast("Select a manifestation first");
    return;
  }

  closeLivingStateTendModal();

  const cabinetChoices = getLivingStateCabinetChoices();
  const apothecaryChoices = getLivingStateApothecaryChoices();

  const modal = document.createElement("div");
  modal.className = "living-state-tend-modal";
  modal.setAttribute("data-living-state-tend-modal", "");

  modal.innerHTML = `
    <div class="living-state-tend-card" role="dialog" aria-modal="true" aria-label="Tend manifestation">
      <button class="living-state-tend-close" type="button" data-living-state-tend-close aria-label="Close">
        ×
      </button>

      <p class="eyebrow">Living State</p>
      <h2>Tend Manifestation</h2>

      <p class="living-state-tend-intro">
        Choose what tending means for this manifestation. These are records of your practice, not judgments about effectiveness.
      </p>

      <form data-living-state-tend-form>
        <input type="hidden" name="instance_id" value="${escapeLivingStateHtml(selectedObject.dataset.instanceId)}" />

        <fieldset class="living-state-tend-section">
          <legend>Cabinet Items</legend>

          <div class="living-state-choice-list">
            ${
              cabinetChoices.length
                ? cabinetChoices.map(renderLivingStateChoice).join("")
                : `<p class="altar-info-empty">No cabinet items found.</p>`
            }
          </div>
        </fieldset>

        <fieldset class="living-state-tend-section">
          <legend>Apothecary Items</legend>

          <div class="living-state-choice-list">
            ${
              apothecaryChoices.length
                ? apothecaryChoices.map(renderLivingStateChoice).join("")
                : `<p class="altar-info-empty">No apothecary items saved yet.</p>`
            }
          </div>
        </fieldset>

        <fieldset class="living-state-tend-section">
          <legend>Tending Method</legend>

          <div class="living-state-method-list">
            <label><input type="checkbox" name="tend_method" value="oil" /> Oil or anointing</label>
            <label><input type="checkbox" name="tend_method" value="herbs" /> Herbs or botanicals</label>
            <label><input type="checkbox" name="tend_method" value="crystals" /> Crystals or stones</label>
            <label><input type="checkbox" name="tend_method" value="smoke" /> Incense, smoke, or scent</label>
            <label><input type="checkbox" name="tend_method" value="offering" /> Offering</label>
            <label><input type="checkbox" name="tend_method" value="moon-charge" /> Moon charge</label>
            <label><input type="checkbox" name="tend_method" value="sun-charge" /> Sun charge</label>
            <label><input type="checkbox" name="tend_method" value="spoken-petition" /> Spoken prayer, petition, or breath</label>
            <label><input type="checkbox" name="tend_method" value="repeat-ritual" /> Repeated or reworked ritual</label>
            <label><input type="checkbox" name="tend_method" value="custom" /> Custom tending</label>
          </div>
        </fieldset>

        <label>
          Notes
          <textarea
            name="notes"
            rows="4"
            placeholder="What did you do? What did you notice? What do you want to remember?"
          ></textarea>
        </label>

        <fieldset class="living-state-tend-section">
          <legend>Next Reminder</legend>

          <label class="my-sanctuary-check">
            <input type="checkbox" name="reset_tending_reminder" checked />
            Set the next tending reminder from today
          </label>

          <label>
            Remind me again in
            <input type="number" name="next_tending_days" min="1" placeholder="Use this manifestation’s current interval" />
          </label>
        </fieldset>

        <button class="button button--primary" type="submit">
          Save Tending
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("altar-modal-open");
}

function closeLivingStateTendModal() {
  const modal = document.querySelector("[data-living-state-tend-modal]");
  if (!modal) return;

  modal.remove();
  document.body.classList.remove("altar-modal-open");
}

function getSelectedLivingStateTendChoices(form) {
  return Array.from(form.querySelectorAll("[data-tend-choice]:checked")).map((input) => ({
    source: input.dataset.tendSource || "",
    label: input.dataset.tendLabel || "",
    type: input.dataset.tendType || "",
    entityId: input.dataset.tendEntityId || "",
    instanceId: input.dataset.tendInstanceId || "",
    itemId: input.dataset.tendItemId || ""
  }));
}

function getSelectedLivingStateTendMethods(form) {
  return Array.from(form.querySelectorAll('input[name="tend_method"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);
}

function formatLivingStateTendSummary(choices = [], methods = []) {
  const choiceLabels = choices.map((choice) => choice.label).filter(Boolean);
  const methodLabels = methods.map((method) => method.replaceAll("-", " "));

  const parts = [];

  if (choiceLabels.length) {
    parts.push(`Used: ${choiceLabels.join(", ")}`);
  }

  if (methodLabels.length) {
    parts.push(`Method: ${methodLabels.join(", ")}`);
  }

  return parts.join(". ");
}

async function submitLivingStateTendForm(form) {
  const instanceId = form.instance_id.value || "";
  if (!instanceId) return;

  const instance =
    typeof getObjectInstance === "function"
      ? await getObjectInstance(instanceId)
      : null;

  if (!instance) {
    showAltarToast("Living State could not be loaded");
    return;
  }

  const choices = getSelectedLivingStateTendChoices(form);
  const methods = getSelectedLivingStateTendMethods(form);
  const notes = String(form.notes.value || "").trim();
  const resetReminder = form.reset_tending_reminder.checked;
  const customNextDays = Number(form.next_tending_days.value || 0);

  const summary = formatLivingStateTendSummary(choices, methods);
  const eventNotes = [summary, notes].filter(Boolean).join("\n\n") || "Manifestation tended.";

  const now = new Date().toISOString();

  await addObjectInstanceEvent(instanceId, "tended", {
    label: "Manifestation Tended",
    notes: eventNotes,
    metadata: {
      choices,
      methods,
      notes
    }
  });

  const existingMetadata = instance.metadata || {};
  const nextInterval =
    customNextDays ||
    instance.tending_interval_days ||
    existingMetadata.tending_interval_days ||
    30;

  const updates = {
    metadata: {
      ...existingMetadata,
      last_tended_at: now,
      last_tending_summary: eventNotes,
      last_tending_choices: choices,
      last_tending_methods: methods
    }
  };

  if (resetReminder && instance.tending_enabled !== false) {
    updates.tending_interval_days = nextInterval;
    updates.tending_due_at = addDaysFromNowForLivingState(nextInterval);
  }

  await updateObjectInstance(instanceId, updates);

  closeLivingStateTendModal();

  if (selectedObject?.dataset.instanceId === instanceId && typeof showLivingStatePanel === "function") {
    await showLivingStatePanel(selectedObject);
  }

  showAltarToast("Living State updated");
}