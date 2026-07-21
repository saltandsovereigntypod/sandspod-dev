/* =========================================================
   RITUAL JOURNAL
   Post-session reflection, Book of Shadows entry, and entity links
   ========================================================= */

let pendingRitualJournalSession = null;
let pendingRitualJournalSteps = [];
let pendingRitualJournalMode = "completed_session";

function getRitualJournalObjects(snapshot = {}) {
  const seen = new Set();
  return (Array.isArray(snapshot.objects) ? snapshot.objects : [])
    .map((object) => ({
      label: object.label || object.herb || object.crystal || object.tool || object.vessel || object.deity || "Altar item",
      type: object.type || "item",
      entityId: object.entityId || "",
      instanceId: object.instanceId || "",
      apothecaryItemId: object.apothecaryItemId || "",
      color: object.color || "",
      dressings: object.dressings || "[]"
    }))
    .filter((object) => {
      const key = `${object.type}|${object.label}|${object.entityId}|${object.instanceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getRitualJournalDuration(session) {
  if (!session?.started_at || !session?.ended_at) return null;
  return Math.max(0, Math.floor((new Date(session.ended_at) - new Date(session.started_at)) / 1000) - Number(session.paused_seconds || 0));
}

function formatRitualJournalDate(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function buildRitualJournalSummary(session) {
  const snapshot = session?.altar_snapshot || {};
  const objects = getRitualJournalObjects(snapshot);
  const duration = getRitualJournalDuration(session);
  const context = session?.context_snapshot || {};
  const completedSteps = pendingRitualJournalSteps.filter((step) => step.status === "completed").length;
  const skippedSteps = pendingRitualJournalSteps.filter((step) => step.status === "skipped").length;

  return {
    objects,
    duration,
    context,
    completedSteps,
    skippedSteps,
    title: session?.title || snapshot.name || "Untitled Ritual"
  };
}

function renderRitualJournalForm(session, mode = "completed_session") {
  pendingRitualJournalSession = session;
  pendingRitualJournalMode = mode;

  const { eyebrow, title, content } = getRitualCompanionElements();
  if (!content) return;

  setRitualPanelMode(true);
  document.body.classList.add("ritual-session-active");
  if (eyebrow) eyebrow.textContent = mode === "completed_session" ? "Ritual Complete" : "Ritual Journal";
  if (title) title.textContent = "Record What Remains";

  const summary = buildRitualJournalSummary(session);
  const itemMarkup = summary.objects.length
    ? summary.objects.map((object) => `<span class="ritual-journal-item">${escapeRitualHtml(object.label)}</span>`).join("")
    : `<span class="ritual-empty-note">No altar items were present.</span>`;

  content.innerHTML = `
    <form class="ritual-journal-form" data-ritual-journal-form>
      <div class="ritual-journal-summary">
        <p class="ritual-companion-kicker">The facts are already held</p>
        <h3>${escapeRitualHtml(summary.title)}</h3>
        <div class="ritual-journal-facts">
          <div class="ritual-journal-fact"><span>Started</span>${formatRitualJournalDate(session.started_at)}</div>
          <div class="ritual-journal-fact"><span>Duration</span>${summary.duration === null ? "Add manually" : formatRitualSeconds(summary.duration)}</div>
          <div class="ritual-journal-fact"><span>Day</span>${escapeRitualHtml(summary.context.dayOfWeek || new Date(session.started_at || Date.now()).toLocaleDateString([], { weekday: "long" }))}</div>
          <div class="ritual-journal-fact"><span>Time of day</span>${escapeRitualHtml(summary.context.timeOfDay || getRitualTimeOfDay(new Date(session.started_at || Date.now())))}</div>
          ${pendingRitualJournalSteps.length ? `<div class="ritual-journal-fact"><span>Steps</span>${summary.completedSteps} completed${summary.skippedSteps ? `, ${summary.skippedSteps} skipped` : ""}</div>` : ""}
          <div class="ritual-journal-fact"><span>Altar items</span>${summary.objects.length}</div>
        </div>
        <div>
          <span class="ritual-journal-items-label">Present on the altar</span>
          <div class="ritual-journal-items">${itemMarkup}</div>
        </div>
      </div>

      <div class="ritual-journal-section">
        <h3>The Threshold</h3>
        <div class="ritual-journal-grid">
          <label>Ritual name<input name="title" required value="${escapeRitualHtml(summary.title)}" /></label>
          <label>Moon phase<input name="moon_phase" placeholder="Optional" /></label>
        </div>
        <label>Intention<textarea name="intention" placeholder="What were you tending, honoring, releasing, or inviting?">${escapeRitualHtml(session.intention || "")}</textarea></label>
        ${summary.duration === null ? `<label>Approximate duration in minutes<input name="manual_duration_minutes" type="number" min="0" step="1" /></label>` : ""}
      </div>

      <div class="ritual-journal-section">
        <h3>Before and During</h3>
        <label>How did you feel before beginning?<textarea name="feelings_before"></textarea></label>
        <label>What happened during the ritual?<textarea name="what_happened_during"></textarea></label>
        <label>What did you feel while it was happening?<textarea name="feelings_during"></textarea></label>
        <label>What stood out?<textarea name="signs_and_symbols" placeholder="Signs, sensations, messages, symbols, unexpected moments..."></textarea></label>
      </div>

      <div class="ritual-journal-section">
        <h3>After the Flame</h3>
        <label>What happened afterward?<textarea name="what_happened_after"></textarea></label>
        <label>How do you feel now?<textarea name="feelings_after"></textarea></label>
        <label>Dreams, synchronicities, or follow-up signs<textarea name="dreams_and_follow_up"></textarea></label>
        <label>Results or changes you are watching for<textarea name="results"></textarea></label>
        <label>What would you change next time?<textarea name="changes_for_next_time"></textarea></label>
        <label>Private notes<textarea name="notes"></textarea></label>
      </div>

      <div class="ritual-journal-actions">
        <button class="ritual-journal-button is-primary" type="submit" data-journal-save-mode="journal">Save to My Ritual Journal</button>
        <button class="ritual-journal-button" type="submit" data-journal-save-mode="template">Save and Turn Into a Template</button>
        <button class="ritual-journal-button" type="button" data-finish-without-journal>Finish Without Journaling</button>
      </div>
      <p class="ritual-journal-status" data-ritual-journal-status role="status"></p>
    </form>
  `;
}

async function ensureRitualJournalGrimoirePage(user, ritual, formValues, summary) {
  let { data: book, error: bookError } = await db
    .from("grimoire_books")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (bookError) throw bookError;

  if (!book) {
    const result = await db.from("grimoire_books").insert({ user_id: user.id, title: "Book of Shadows" }).select("id").single();
    if (result.error) throw result.error;
    book = result.data;
  }

  let { data: section, error: sectionError } = await db
    .from("grimoire_sections")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", book.id)
    .eq("title", "Ritual Journal")
    .maybeSingle();
  if (sectionError) throw sectionError;

  if (!section) {
    const result = await db.from("grimoire_sections").insert({
      user_id: user.id,
      book_id: book.id,
      title: "Ritual Journal",
      sort_order: 1
    }).select("id").single();
    if (result.error) throw result.error;
    section = result.data;
  }

  const { data: page, error: pageError } = await db.from("grimoire_pages").insert({
    user_id: user.id,
    book_id: book.id,
    section_id: section.id,
    title: ritual.title,
    icon: "🕯️",
    page_type: "ritual_journal",
    metadata: {
      ritualId: ritual.id,
      sessionId: ritual.session_id,
      templateId: ritual.template_id,
      ritualDate: ritual.ritual_date,
      durationSeconds: ritual.duration_seconds,
      moonPhase: ritual.moon_phase,
      altarItems: summary.objects
    }
  }).select("id").single();
  if (pageError) throw pageError;

  const blocks = [
    ["heading", "Intention"], ["text", formValues.intention],
    ["heading", "What Happened During"], ["text", formValues.what_happened_during],
    ["heading", "Feelings and Impressions"], ["text", [formValues.feelings_before, formValues.feelings_during, formValues.feelings_after].filter(Boolean).join("\n\n")],
    ["heading", "Signs and Symbols"], ["text", formValues.signs_and_symbols],
    ["heading", "Afterward"], ["text", formValues.what_happened_after],
    ["heading", "Follow-up"], ["text", [formValues.dreams_and_follow_up, formValues.results, formValues.changes_for_next_time].filter(Boolean).join("\n\n")],
    ["heading", "Private Notes"], ["text", formValues.notes]
  ].filter(([, value]) => value);

  if (blocks.length) {
    const { error: blocksError } = await db.from("grimoire_blocks").insert(blocks.map(([block_type, content], index) => ({
      user_id: user.id,
      book_id: book.id,
      page_id: page.id,
      block_type,
      content,
      sort_order: index,
      metadata: { ritualId: ritual.id }
    })));
    if (blocksError) throw blocksError;
  }

  return page.id;
}

async function createRitualJournalLinks(user, ritual, pageId, summary) {
  const links = [];
  const seenEntities = new Set();

  summary.objects.forEach((object) => {
    if (object.entityId && !seenEntities.has(object.entityId)) {
      seenEntities.add(object.entityId);
      links.push({ user_id: user.id, ritual_id: ritual.id, link_type: "used_entity", entity_id: object.entityId, label: object.label, metadata: { type: object.type } });
    }
    if (object.instanceId && /^[0-9a-f-]{36}$/i.test(object.instanceId)) {
      links.push({ user_id: user.id, ritual_id: ritual.id, link_type: "used_object_instance", object_instance_id: object.instanceId, label: object.label });
    }
    if (object.apothecaryItemId && /^[0-9a-f-]{36}$/i.test(object.apothecaryItemId)) {
      links.push({ user_id: user.id, ritual_id: ritual.id, link_type: "used_apothecary_item", apothecary_item_id: object.apothecaryItemId, label: object.label });
    }
  });

  if (pageId) links.push({ user_id: user.id, ritual_id: ritual.id, link_type: "grimoire_page", grimoire_page_id: pageId, label: ritual.title });
  if (ritual.linked_altar_id) links.push({ user_id: user.id, ritual_id: ritual.id, link_type: "altar", saved_altar_id: ritual.linked_altar_id, label: "Linked altar" });

  if (links.length) {
    const { error } = await db.from("ritual_links").insert(links);
    if (error) throw error;
  }
}

async function saveRitualJournal(form, saveMode = "journal") {
  const user = await getRitualUser();
  if (!user) throw new Error("Sign in to save this ritual journal entry.");

  const session = pendingRitualJournalSession;
  if (!session) throw new Error("No ritual is ready to journal.");

  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  const summary = buildRitualJournalSummary(session);
  const manualMinutes = Number(values.manual_duration_minutes || 0);
  const durationSeconds = summary.duration === null ? Math.round(manualMinutes * 60) : summary.duration;
  const started = session.started_at ? new Date(session.started_at) : new Date();

  const payload = {
    user_id: user.id,
    title: String(values.title || summary.title).trim(),
    intention: String(values.intention || "").trim() || null,
    notes: String(values.notes || "").trim() || null,
    moon_phase: String(values.moon_phase || "").trim() || null,
    linked_altar: session.linked_altar_id || null,
    tags: [],
    ritual_date: started.toISOString().slice(0, 10),
    source: session.source === "template" ? "template" : "digital_altar",
    template_id: session.template_id || null,
    session_id: session.id || null,
    linked_altar_id: session.linked_altar_id || null,
    started_at: session.started_at || null,
    ended_at: session.ended_at || null,
    duration_seconds: durationSeconds,
    time_of_day: summary.context.timeOfDay || getRitualTimeOfDay(started),
    day_of_week: summary.context.dayOfWeek || started.toLocaleDateString([], { weekday: "long" }),
    preparation: null,
    what_happened_during: String(values.what_happened_during || "").trim() || null,
    what_happened_after: String(values.what_happened_after || "").trim() || null,
    feelings_before: String(values.feelings_before || "").trim() || null,
    feelings_during: String(values.feelings_during || "").trim() || null,
    feelings_after: String(values.feelings_after || "").trim() || null,
    signs_and_symbols: String(values.signs_and_symbols || "").trim() || null,
    dreams_and_follow_up: String(values.dreams_and_follow_up || "").trim() || null,
    results: String(values.results || "").trim() || null,
    changes_for_next_time: String(values.changes_for_next_time || "").trim() || null,
    altar_snapshot: session.altar_snapshot || {},
    context_snapshot: session.context_snapshot || {},
    metadata: {
      journalVersion: 1,
      mode: pendingRitualJournalMode,
      completedSteps: pendingRitualJournalSteps.map((step) => ({ title: step.title, status: step.status, elapsedSeconds: step.elapsed_seconds }))
    }
  };

  const { data: ritual, error } = await db.from("user_rituals").insert(payload).select("*").single();
  if (error) throw error;

  const pageId = await ensureRitualJournalGrimoirePage(user, ritual, values, summary);
  const { error: updateError } = await db.from("user_rituals").update({ grimoire_page_id: pageId }).eq("id", ritual.id).eq("user_id", user.id);
  if (updateError) throw updateError;

  ritual.grimoire_page_id = pageId;
  await createRitualJournalLinks(user, ritual, pageId, summary);

  if (saveMode === "template" && typeof openRitualTemplateEditor === "function") {
    finishRitualJournal();
    await openRitualTemplateEditor();
    const editor = document.querySelector("[data-ritual-template-editor-form]");
    if (editor) {
      const titleField = editor.querySelector('[name="title"]');
      const intentionField = editor.querySelector('[name="intention"]');
      const altarField = editor.querySelector('[name="linked_altar_id"]');
      if (titleField) titleField.value = ritual.title;
      if (intentionField) intentionField.value = ritual.intention || "";
      if (altarField && ritual.linked_altar_id) altarField.value = ritual.linked_altar_id;
    }
    return ritual;
  }

  renderRitualJournalSaved(ritual);
  return ritual;
}

function renderRitualJournalSaved(ritual) {
  const { eyebrow, title, content } = getRitualCompanionElements();
  if (eyebrow) eyebrow.textContent = "Ritual Journal";
  if (title) title.textContent = "Entry Preserved";
  if (!content) return;

  content.innerHTML = `
    <div class="ritual-journal-saved">
      <p class="ritual-companion-kicker">Held in your Book of Shadows</p>
      <h3 class="ritual-companion-title">${escapeRitualHtml(ritual.title)}</h3>
      <p>Your reflections, altar details, timing, and Living Library connections have been saved.</p>
      <button type="button" class="ritual-journal-button is-primary" data-close-ritual-journal>Return to the Altar</button>
    </div>
  `;
}

function finishRitualJournal() {
  pendingRitualJournalSession = null;
  pendingRitualJournalSteps = [];
  pendingRitualJournalMode = "completed_session";
  document.body.classList.remove("ritual-session-active");
  ritualPanelView = "home";
  renderRitualHome();
}

if (typeof completeActiveRitualSession === "function") {
  const originalCompleteActiveRitualSession = completeActiveRitualSession;
  completeActiveRitualSession = async function completeRitualThenJournal(status = "completed") {
    const sessionBefore = activeRitualSession ? { ...activeRitualSession } : getStoredActiveRitualSession();
    const stepsBefore = Array.isArray(activeRitualSteps) ? activeRitualSteps.map((step) => ({ ...step })) : [];
    const completed = await originalCompleteActiveRitualSession(status);

    if (status === "completed") {
      pendingRitualJournalSteps = stepsBefore;
      renderRitualJournalForm({ ...sessionBefore, ...completed }, "completed_session");
    }

    return completed;
  };
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-ritual-journal-form]");
  if (!form) return;
  event.preventDefault();

  const submitter = event.submitter;
  const mode = submitter?.dataset.journalSaveMode || "journal";
  const status = form.querySelector("[data-ritual-journal-status]");

  try {
    if (status) status.textContent = "Preserving this ritual...";
    await saveRitualJournal(form, mode);
  } catch (error) {
    console.error(error);
    if (status) status.textContent = error.message || "The ritual could not be saved.";
  }
});

document.addEventListener("click", (event) => {
  const finishButton = event.target.closest("[data-finish-without-journal]");
  const closeButton = event.target.closest("[data-close-ritual-journal]");
  if (!finishButton && !closeButton) return;
  event.preventDefault();
  finishRitualJournal();
});

// Save Ritual can journal the current altar even when no timed session was started.
document.addEventListener(
  "click",
  (event) => {
    const saveButton = event.target.closest('[data-global-action="save-as-ritual"]');
    if (!saveButton) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (activeRitualSession || getStoredActiveRitualSession()?.id) {
      showAltarToast("Complete the active ritual before journaling it");
      return;
    }

    const now = new Date();
    const snapshot = typeof createAltarSnapshot === "function" ? createAltarSnapshot("Ritual Journal Entry") : {};
    pendingRitualJournalSteps = [];
    renderRitualJournalForm({
      id: null,
      title: snapshot?.name || "Untitled Ritual",
      intention: null,
      source: "digital_altar",
      status: "completed",
      started_at: null,
      ended_at: now.toISOString(),
      paused_seconds: 0,
      altar_snapshot: snapshot || {},
      context_snapshot: createRitualContextSnapshot(),
      event_log: []
    }, "altar_snapshot");
  },
  true
);
