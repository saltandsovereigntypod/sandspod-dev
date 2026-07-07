/* =========================================================
   LIVING STATE ACTIONS
   Tending flows for object manifestations
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

const livingStateTendMethods = [
  { id: "oil", label: "Oil", hint: "Anointing, dressing, sealing", types: ["oil"] },
  { id: "herbs", label: "Herbs", hint: "Loose herbs, sprigs, powders", types: ["herb"] },
  { id: "crystals", label: "Crystals", hint: "Stones, chips, clusters", types: ["crystal"] },
  { id: "smoke", label: "Smoke", hint: "Incense, smoke, scent", types: ["incense", "herb"] },
  { id: "offering", label: "Offering", hint: "Food, drink, flowers, devotional gifts", types: ["offering"] },
  { id: "moon-charge", label: "Moon Charge", hint: "Lunar exposure or ritual", types: [] },
  { id: "sun-charge", label: "Sun Charge", hint: "Solar exposure or ritual", types: [] },
  { id: "spoken-petition", label: "Prayer / Breath", hint: "Words, petition, song, breath", types: [] },
  { id: "repeat-ritual", label: "Repeat Ritual", hint: "Rework or repeat the original rite", types: [] },
  { id: "custom", label: "Custom", hint: "Anything else you want to record", types: [] }
];

function getLivingStateMethodById(methodId) {
  return livingStateTendMethods.find((method) => method.id === methodId);
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
        entityName:
          form.herb ||
          form.crystal ||
          form.tool ||
          form.vessel ||
          form.deity ||
          form.color ||
          item.name
      }));
    });
}

function getLivingStateApothecaryChoices() {
  if (typeof getApothecaryItems !== "function") return [];

  return getApothecaryItems().map((item) => ({
    source: "apothecary",
    label: item.name,
    type: item.typeLabel || item.type || "Apothecary Item",
    form: item.type || "",
    itemId: item.id,
    entityId: item.entityId || "",
    instanceId: item.instanceId || ""
  }));
}

function getAllLivingStateTendChoices() {
  return [
    ...getLivingStateCabinetChoices(),
    ...getLivingStateApothecaryChoices()
  ];
}

function getSelectedLivingStateMethods(modal) {
  return Array.from(modal.querySelectorAll("[data-tend-method].is-selected"))
    .map((button) => button.dataset.tendMethod)
    .filter(Boolean);
}

function getSelectedLivingStateChoices(modal) {
  return Array.from(modal.querySelectorAll("[data-tend-choice].is-selected")).map((button) => ({
    source: button.dataset.tendSource || "",
    label: button.dataset.tendLabel || "",
    type: button.dataset.tendType || "",
    form: button.dataset.tendForm || "",
    entityId: button.dataset.tendEntityId || "",
    instanceId: button.dataset.tendInstanceId || "",
    itemId: button.dataset.tendItemId || ""
  }));
}

function livingStateChoiceMatchesMethods(choice, selectedMethods = []) {
  if (!selectedMethods.length) return true;

  return selectedMethods.some((methodId) => {
    const method = getLivingStateMethodById(methodId);
    if (!method) return false;

    if (!method.types.length) return false;

    return method.types.includes(choice.type) || method.types.includes(choice.form);
  });
}

function renderLivingStateMethodCards(selectedMethods = []) {
  return livingStateTendMethods
    .map((method) => {
      const selected = selectedMethods.includes(method.id);

      return `
        <button
          type="button"
          class="living-state-method-card ${selected ? "is-selected" : ""}"
          data-tend-method="${escapeLivingStateHtml(method.id)}"
          aria-pressed="${selected ? "true" : "false"}">
          <span>${escapeLivingStateHtml(method.label)}</span>
          <small>${escapeLivingStateHtml(method.hint)}</small>
        </button>
      `;
    })
    .join("");
}

function renderLivingStateChoiceCards(choices = [], selectedChoices = []) {
  if (!choices.length) {
    return `<p class="altar-info-empty">No matching supports found. You can still record this tending with notes.</p>`;
  }

  return choices
    .map((choice) => {
      const selected = selectedChoices.some((selectedChoice) => {
        return (
          selectedChoice.source === choice.source &&
          selectedChoice.label === choice.label &&
          selectedChoice.type === choice.type
        );
      });

      return `
        <button
          type="button"
          class="living-state-choice-card ${selected ? "is-selected" : ""}"
          data-tend-choice
          data-tend-source="${escapeLivingStateHtml(choice.source)}"
          data-tend-label="${escapeLivingStateHtml(choice.label)}"
          data-tend-type="${escapeLivingStateHtml(choice.type)}"
          data-tend-form="${escapeLivingStateHtml(choice.form || "")}"
          data-tend-entity-id="${escapeLivingStateHtml(choice.entityId || "")}"
          data-tend-instance-id="${escapeLivingStateHtml(choice.instanceId || "")}"
          data-tend-item-id="${escapeLivingStateHtml(choice.itemId || "")}"
          aria-pressed="${selected ? "true" : "false"}">
          <span>${escapeLivingStateHtml(choice.label)}</span>
          <small>${escapeLivingStateHtml(choice.source)}${choice.type ? ` · ${escapeLivingStateHtml(choice.type)}` : ""}</small>
        </button>
      `;
    })
    .join("");
}

function renderLivingStateSelectedPreview(selectedMethods = [], selectedChoices = []) {
  const methodLabels = selectedMethods
    .map((methodId) => getLivingStateMethodById(methodId)?.label)
    .filter(Boolean);

  const choiceLabels = selectedChoices.map((choice) => choice.label).filter(Boolean);

  if (!methodLabels.length && !choiceLabels.length) {
    return `<p>Choose one or more tending methods, then add any supports you used.</p>`;
  }

  return `
    ${methodLabels.length ? `<p><strong>Methods:</strong> ${methodLabels.join(", ")}</p>` : ""}
    ${choiceLabels.length ? `<p><strong>Supports:</strong> ${choiceLabels.join(", ")}</p>` : ""}
  `;
}

function updateLivingStateTendModal() {
  const modal = document.querySelector("[data-living-state-tend-modal]");
  if (!modal) return;

  const selectedMethods = getSelectedLivingStateMethods(modal);
  const selectedChoices = getSelectedLivingStateChoices(modal);
  const searchTerm = String(modal.querySelector("[data-tend-search]")?.value || "").toLowerCase().trim();

  let choices = getAllLivingStateTendChoices();

  choices = choices.filter((choice) => livingStateChoiceMatchesMethods(choice, selectedMethods));

  if (searchTerm) {
    choices = choices.filter((choice) => {
      return [
        choice.label,
        choice.source,
        choice.type,
        choice.form
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    });
  }

  const methodsWrap = modal.querySelector("[data-tend-methods]");
  const choicesWrap = modal.querySelector("[data-tend-choices]");
  const previewWrap = modal.querySelector("[data-tend-preview]");

  if (methodsWrap) {
    methodsWrap.innerHTML = renderLivingStateMethodCards(selectedMethods);
  }

  if (choicesWrap) {
    choicesWrap.innerHTML = renderLivingStateChoiceCards(choices, selectedChoices);
  }

  if (previewWrap) {
    previewWrap.innerHTML = renderLivingStateSelectedPreview(selectedMethods, selectedChoices);
  }
}

function openLivingStateTendModal() {
  if (!selectedObject?.dataset.instanceId) {
    showAltarToast("Select a manifestation first");
    return;
  }

  closeLivingStateTendModal();

  const modal = document.createElement("div");
  modal.className = "living-state-tend-modal";
  modal.setAttribute("data-living-state-tend-modal", "");

  modal.innerHTML = `
    <div class="living-state-tend-card" role="dialog" aria-modal="true" aria-label="Tend manifestation">
      <button class="living-state-tend-close" type="button" data-living-state-tend-close aria-label="Close">
        ×
      </button>

      <p class="eyebrow">Living State</p>
      <h2>Today's Tending</h2>

      <p class="living-state-tend-intro">
        Choose how you would like to care for this manifestation today. There is no required way to tend. Record only what feels meaningful to your practice.
      </p>

      <form data-living-state-tend-form>
        <input type="hidden" name="instance_id" value="${escapeLivingStateHtml(selectedObject.dataset.instanceId)}" />

        <section class="living-state-tend-section">
          <p class="living-state-step-label">
            1. How would you like to tend this manifestation?
          </p>
          <div class="living-state-method-grid" data-tend-methods>
            ${renderLivingStateMethodCards([])}
          </div>
        </section>

        <section class="living-state-tend-section">
          <p class="living-state-step-label">
            2. What would you like to use?
          </p>

          <input
            type="search"
            class="living-state-search"
            data-tend-search
            placeholder="Search herbs, oils, crystals, apothecary items..."
          />

          <div class="living-state-choice-grid" data-tend-choices>
            ${renderLivingStateChoiceCards(getAllLivingStateTendChoices(), [])}
          </div>
        </section>

        <section class="living-state-tend-section">
          <p class="living-state-step-label">
            3. Your ritual so far
          </p>
          <div class="living-state-selected-preview" data-tend-preview>
            ${renderLivingStateSelectedPreview([], [])}
          </div>
        </section>

        <label>
          Reflections
          <textarea
            name="notes"
            rows="4"
            placeholder="Record any thoughts, feelings, sensations, signs, or observations you'd like to remember."
          ></textarea>
        </label>

        <section class="living-state-tend-section">
          <p class="living-state-step-label">
            4. Create a reusable blend
          </p>

          <label class="my-sanctuary-check">
            <input type="checkbox" name="save_as_apothecary" />
            Create this combination as a reusable Apothecary item.
          </label>

          <label>
            Apothecary item name
            <input
              type="text"
              name="apothecary_name"
              placeholder="Dream Sachet Tending Blend, Protection Jar Feeding Oil..."
            />
          </label>
        </section>

        <section class="living-state-tend-section">
          <p class="living-state-step-label">
            5. Future tending
          </p>

          <label class="my-sanctuary-check">
            <input type="checkbox" name="reset_tending_reminder" checked />
            Begin the next tending cycle today.
          </label>

          <label>
            Suggest another tending reminder in
            <input
              type="number"
              name="next_tending_days"
              min="1"
              placeholder="Use this manifestation’s current interval"
            />
          </label>
        </section>

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

function getSelectedLivingStateTendMethods(form) {
  const modal = form.closest("[data-living-state-tend-modal]");
  return modal ? getSelectedLivingStateMethods(modal) : [];
}

function getSelectedLivingStateTendChoices(form) {
  const modal = form.closest("[data-living-state-tend-modal]");
  return modal ? getSelectedLivingStateChoices(modal) : [];
}

function formatLivingStateTendSummary(choices = [], methods = []) {
  const methodLabels = methods
    .map((methodId) => getLivingStateMethodById(methodId)?.label || methodId.replaceAll("-", " "))
    .filter(Boolean);

  const choiceLabels = choices.map((choice) => choice.label).filter(Boolean);

  const parts = [];

  if (methodLabels.length) {
    parts.push(`Methods: ${methodLabels.join(", ")}`);
  }

  if (choiceLabels.length) {
    parts.push(`Supports: ${choiceLabels.join(", ")}`);
  }

  return parts.join(". ");
}

async function createApothecaryItemFromTending(form, choices = [], methods = [], instance = null) {
  if (!form.save_as_apothecary?.checked) return null;
  if (!choices.length) return null;
  if (typeof getApothecaryItems !== "function" || typeof saveApothecaryItems !== "function") return null;

  const name =
    String(form.apothecary_name?.value || "").trim() ||
    `${instance?.name || "Manifestation"} Tending Blend`;

  const now = new Date().toISOString();
  const methodLabels = methods
    .map((methodId) => getLivingStateMethodById(methodId)?.label || methodId)
    .filter(Boolean);

  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    type: "tending-blend",
    typeLabel: "Tending Blend",
    imagePath: "../assets/altar/objects/vessels/spell-jar/spell-jar.png",
    intention: `Tending for ${instance?.name || "manifestation"}`,
    notes: methodLabels.length ? `Methods: ${methodLabels.join(", ")}` : "",
    logToGrimoire: true,
    grimoireStatus: "linked to Living Library",
    grimoireEntryId: "",
    entityId: "",
    instanceId: "",
    livingState: {
      tending_enabled: false,
      tending_interval_days: null,
      expiration_enabled: false,
      expiration_days: null
    },
    ingredients: choices.map((choice) => ({
      label: choice.label,
      type: choice.type,
      form: choice.form,
      entityId: choice.entityId || "",
      libraryName: choice.label,
      libraryType: choice.type,
      amount: ""
    })),
    createdAt: now,
    updatedAt: now
  };

  if (typeof createOrUpdateApothecaryLibraryEntity === "function") {
    const enriched = await createOrUpdateApothecaryLibraryEntity(item);
    Object.assign(item, enriched);
  }

  const items = getApothecaryItems();
  saveApothecaryItems([item, ...items]);

  if (typeof renderApothecaryItems === "function") {
    renderApothecaryItems();
  }

  return item;
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

  const savedApothecaryItem = await createApothecaryItemFromTending(form, choices, methods, instance);

  const summary = formatLivingStateTendSummary(choices, methods);
  const savedApothecaryNote = savedApothecaryItem
    ? `Saved for future tending as ${savedApothecaryItem.name}.`
    : "";

  const eventNotes =
    [summary, notes, savedApothecaryNote].filter(Boolean).join("\n\n") ||
    "Manifestation tended.";

  const now = new Date().toISOString();

  await addObjectInstanceEvent(instanceId, "tended", {
    label: "Manifestation Tended",
    notes: eventNotes,
    metadata: {
      choices,
      methods,
      notes,
      savedApothecaryItemId: savedApothecaryItem?.id || ""
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
      last_tending_methods: methods,
      saved_tending_apothecary_item_id: savedApothecaryItem?.id || existingMetadata.saved_tending_apothecary_item_id || ""
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

document.addEventListener("click", (event) => {
  const methodButton = event.target.closest("[data-tend-method]");
  const choiceButton = event.target.closest("[data-tend-choice]");

  if (methodButton) {
    event.preventDefault();
    methodButton.classList.toggle("is-selected");
    methodButton.setAttribute("aria-pressed", methodButton.classList.contains("is-selected") ? "true" : "false");
    updateLivingStateTendModal();
  }

  if (choiceButton) {
    event.preventDefault();
    choiceButton.classList.toggle("is-selected");
    choiceButton.setAttribute("aria-pressed", choiceButton.classList.contains("is-selected") ? "true" : "false");
    updateLivingStateTendModal();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("[data-tend-search]")) {
    updateLivingStateTendModal();
  }
});