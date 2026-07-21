/* =========================================================
   RITUAL SYSTEM
   Companion panel ritual launcher and live ritual runner
   ========================================================= */

const ACTIVE_RITUAL_SESSION_KEY = "saltAndSovereigntyActiveRitualSession";

let ritualPanelView = "home";
let activeRitualSession = null;
let activeRitualSteps = [];
let ritualSessionClockInterval = null;
let ritualStepClockInterval = null;
let ritualPanelRenderLock = false;

function getStoredActiveRitualSession() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_RITUAL_SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function storeActiveRitualSession(session) {
  if (!session) {
    localStorage.removeItem(ACTIVE_RITUAL_SESSION_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_RITUAL_SESSION_KEY, JSON.stringify(session));
}

function getRitualTimeOfDay(date = new Date()) {
  const hour = date.getHours();

  if (hour < 5) return "Late Night";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

function createRitualContextSnapshot() {
  const now = new Date();

  return {
    capturedAt: now.toISOString(),
    dayOfWeek: now.toLocaleDateString(undefined, { weekday: "long" }),
    timeOfDay: getRitualTimeOfDay(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    locale: navigator.language || ""
  };
}

function formatRitualSeconds(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function escapeRitualHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getRitualUser() {
  if (typeof currentUser !== "undefined" && currentUser) {
    return currentUser;
  }

  const { data, error } = await db.auth.getUser();

  if (error) throw error;
  return data.user || null;
}

function getRitualCompanionElements() {
  const panel = typeof altarCompanionPanel !== "undefined"
    ? altarCompanionPanel
    : document.querySelector(".altar-companion-panel");

  return {
    panel,
    eyebrow: panel?.querySelector(".altar-companion-header .eyebrow"),
    title: panel?.querySelector(".altar-companion-header h2"),
    content: panel?.querySelector("[data-companion-content]")
  };
}

function setRitualPanelMode(isActive) {
  const { panel } = getRitualCompanionElements();

  panel?.classList.toggle("is-ritual-mode", isActive);
  document.body.classList.toggle("ritual-session-active", isActive);
}

function clearRitualIntervals() {
  window.clearInterval(ritualSessionClockInterval);
  window.clearInterval(ritualStepClockInterval);
  ritualSessionClockInterval = null;
  ritualStepClockInterval = null;
}

function getCurrentRitualStep() {
  if (!activeRitualSession || !activeRitualSteps.length) return null;

  return activeRitualSteps.find((step) => step.status === "active")
    || activeRitualSteps.find((step) => step.status === "pending")
    || null;
}

function getSessionElapsedSeconds() {
  if (!activeRitualSession?.started_at) return 0;

  const end = activeRitualSession.status === "paused" && activeRitualSession.paused_at
    ? new Date(activeRitualSession.paused_at).getTime()
    : Date.now();

  const started = new Date(activeRitualSession.started_at).getTime();
  const pausedSeconds = Number(activeRitualSession.paused_seconds || 0);

  return Math.max(0, Math.floor((end - started) / 1000) - pausedSeconds);
}

function getStepElapsedSeconds(step) {
  if (!step?.started_at) return Number(step?.elapsed_seconds || 0);

  const end = step.status === "completed" || step.status === "skipped"
    ? new Date(step.completed_at || Date.now()).getTime()
    : activeRitualSession?.status === "paused" && activeRitualSession.paused_at
      ? new Date(activeRitualSession.paused_at).getTime()
      : Date.now();

  return Math.max(0, Math.floor((end - new Date(step.started_at).getTime()) / 1000));
}

function startRitualClocks() {
  clearRitualIntervals();

  ritualSessionClockInterval = window.setInterval(() => {
    const target = document.querySelector("[data-ritual-session-clock]");
    if (target) target.textContent = formatRitualSeconds(getSessionElapsedSeconds());
  }, 1000);

  ritualStepClockInterval = window.setInterval(() => {
    const target = document.querySelector("[data-ritual-step-clock]");
    const step = getCurrentRitualStep();

    if (!target || !step) return;

    const elapsed = getStepElapsedSeconds(step);
    const duration = Number(step.duration_seconds || 0);

    target.textContent = duration > 0
      ? formatRitualSeconds(Math.max(0, duration - elapsed))
      : formatRitualSeconds(elapsed);

    if (
      duration > 0
      && elapsed >= duration
      && step.completion_mode === "timed"
      && activeRitualSession?.status === "active"
    ) {
      completeCurrentRitualStep().catch(console.error);
    }
  }, 1000);
}

async function getRitualTemplates() {
  const user = await getRitualUser();
  if (!user) return [];

  const { data, error } = await db
    .from("ritual_templates")
    .select("*, ritual_template_steps(*)")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((template) => ({
    ...template,
    ritual_template_steps: (template.ritual_template_steps || [])
      .sort((a, b) => a.sort_order - b.sort_order)
  }));
}

async function fetchActiveRitualSession() {
  const stored = getStoredActiveRitualSession();
  if (!stored?.id) return null;

  const user = await getRitualUser();
  if (!user) return null;

  const { data: session, error: sessionError } = await db
    .from("ritual_sessions")
    .select("*")
    .eq("id", stored.id)
    .eq("user_id", user.id)
    .in("status", ["active", "paused"])
    .maybeSingle();

  if (sessionError) throw sessionError;

  if (!session) {
    storeActiveRitualSession(null);
    return null;
  }

  const { data: steps, error: stepsError } = await db
    .from("ritual_session_steps")
    .select("*")
    .eq("session_id", session.id)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (stepsError) throw stepsError;

  activeRitualSession = session;
  activeRitualSteps = steps || [];

  return session;
}

async function createFreeRitualSession({ title = "", intention = "" } = {}) {
  const user = await getRitualUser();

  if (!user) {
    throw new Error("Sign in to begin a saved ritual session.");
  }

  const altarSnapshot = typeof createAltarSnapshot === "function"
    ? createAltarSnapshot(title || "Ritual Session")
    : {};

  const { data, error } = await db
    .from("ritual_sessions")
    .insert({
      user_id: user.id,
      title: title || null,
      intention: intention || null,
      source: "digital_altar",
      status: "active",
      current_step_order: 0,
      altar_snapshot: altarSnapshot || {},
      context_snapshot: createRitualContextSnapshot(),
      event_log: [{
        type: "session_started",
        occurredAt: new Date().toISOString(),
        source: "digital_altar"
      }]
    })
    .select("*")
    .single();

  if (error) throw error;

  activeRitualSession = data;
  activeRitualSteps = [];

  storeActiveRitualSession({
    id: data.id,
    title: data.title || "Untitled Ritual",
    startedAt: data.started_at
  });

  document.dispatchEvent(new CustomEvent("saltRitualSessionStarted", {
    detail: { session: data }
  }));

  return data;
}

async function createTemplateRitualSession(template) {
  const user = await getRitualUser();

  if (!user) throw new Error("Sign in to begin a ritual.");

  const altarSnapshot = typeof createAltarSnapshot === "function"
    ? createAltarSnapshot(template.title || "Ritual Session")
    : {};

  const { data: session, error: sessionError } = await db
    .from("ritual_sessions")
    .insert({
      user_id: user.id,
      template_id: template.id,
      linked_altar_id: template.linked_altar_id || null,
      title: template.title,
      intention: template.intention || null,
      source: "template",
      status: "active",
      current_step_order: 0,
      altar_snapshot: altarSnapshot || {},
      context_snapshot: createRitualContextSnapshot(),
      event_log: [{
        type: "template_session_started",
        templateId: template.id,
        occurredAt: new Date().toISOString()
      }]
    })
    .select("*")
    .single();

  if (sessionError) throw sessionError;

  const templateSteps = template.ritual_template_steps || [];
  let sessionSteps = [];

  if (templateSteps.length) {
    const rows = templateSteps.map((step, index) => ({
      user_id: user.id,
      session_id: session.id,
      template_step_id: step.id,
      sort_order: step.sort_order,
      title: step.title,
      instructions: step.instructions,
      spoken_text: step.spoken_text,
      duration_seconds: step.duration_seconds,
      completion_mode: step.completion_mode,
      actions: step.actions || [],
      linked_entities: step.linked_entities || [],
      status: index === 0 ? "active" : "pending",
      started_at: index === 0 ? new Date().toISOString() : null,
      metadata: step.metadata || {}
    }));

    const { data, error } = await db
      .from("ritual_session_steps")
      .insert(rows)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    sessionSteps = data || [];
  }

  activeRitualSession = session;
  activeRitualSteps = sessionSteps;

  storeActiveRitualSession({
    id: session.id,
    title: session.title || "Untitled Ritual",
    startedAt: session.started_at
  });

  document.dispatchEvent(new CustomEvent("saltRitualSessionStarted", {
    detail: { session }
  }));

  return session;
}

async function appendRitualEvent(type, metadata = {}) {
  if (!activeRitualSession?.id) return;

  const user = await getRitualUser();
  if (!user) return;

  const { data, error } = await db
    .from("ritual_sessions")
    .select("event_log")
    .eq("id", activeRitualSession.id)
    .eq("user_id", user.id)
    .single();

  if (error) throw error;

  const eventLog = Array.isArray(data?.event_log) ? data.event_log : [];

  const { error: updateError } = await db
    .from("ritual_sessions")
    .update({
      event_log: [
        ...eventLog,
        { type, occurredAt: new Date().toISOString(), ...metadata }
      ]
    })
    .eq("id", activeRitualSession.id)
    .eq("user_id", user.id);

  if (updateError) throw updateError;
}

async function pauseActiveRitualSession() {
  if (!activeRitualSession?.id || activeRitualSession.status !== "active") return;

  const pausedAt = new Date().toISOString();
  const user = await getRitualUser();

  const { data, error } = await db
    .from("ritual_sessions")
    .update({ status: "paused", paused_at: pausedAt })
    .eq("id", activeRitualSession.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;

  activeRitualSession = data;
  await appendRitualEvent("session_paused");
  renderActiveRitualPanel();
}

async function resumeActiveRitualSession() {
  if (!activeRitualSession?.id || activeRitualSession.status !== "paused") return;

  const user = await getRitualUser();
  const now = Date.now();
  const pausedAt = new Date(activeRitualSession.paused_at || now).getTime();
  const addedPause = Math.max(0, Math.floor((now - pausedAt) / 1000));

  const { data, error } = await db
    .from("ritual_sessions")
    .update({
      status: "active",
      paused_at: null,
      paused_seconds: Number(activeRitualSession.paused_seconds || 0) + addedPause
    })
    .eq("id", activeRitualSession.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;

  activeRitualSession = data;
  await appendRitualEvent("session_resumed");
  renderActiveRitualPanel();
}

async function completeCurrentRitualStep() {
  const step = getCurrentRitualStep();
  if (!step || !activeRitualSession?.id) return;

  const user = await getRitualUser();
  const completedAt = new Date().toISOString();

  const { error } = await db
    .from("ritual_session_steps")
    .update({
      status: "completed",
      completed_at: completedAt,
      elapsed_seconds: getStepElapsedSeconds(step)
    })
    .eq("id", step.id)
    .eq("user_id", user.id);

  if (error) throw error;

  const nextStep = activeRitualSteps.find((item) => item.sort_order > step.sort_order && item.status === "pending");

  if (nextStep) {
    const startedAt = new Date().toISOString();

    const { error: nextError } = await db
      .from("ritual_session_steps")
      .update({ status: "active", started_at: startedAt })
      .eq("id", nextStep.id)
      .eq("user_id", user.id);

    if (nextError) throw nextError;

    await db
      .from("ritual_sessions")
      .update({ current_step_order: nextStep.sort_order })
      .eq("id", activeRitualSession.id)
      .eq("user_id", user.id);
  }

  await appendRitualEvent("step_completed", {
    stepId: step.id,
    stepTitle: step.title
  });

  await fetchActiveRitualSession();
  renderActiveRitualPanel();
}

async function skipCurrentRitualStep() {
  const step = getCurrentRitualStep();
  if (!step || !activeRitualSession?.id) return;

  const user = await getRitualUser();

  const { error } = await db
    .from("ritual_session_steps")
    .update({
      status: "skipped",
      completed_at: new Date().toISOString(),
      elapsed_seconds: getStepElapsedSeconds(step)
    })
    .eq("id", step.id)
    .eq("user_id", user.id);

  if (error) throw error;

  await appendRitualEvent("step_skipped", {
    stepId: step.id,
    stepTitle: step.title
  });

  await fetchActiveRitualSession();

  const nextStep = activeRitualSteps.find((item) => item.status === "pending");
  if (nextStep) {
    await db
      .from("ritual_session_steps")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", nextStep.id)
      .eq("user_id", user.id);

    await fetchActiveRitualSession();
  }

  renderActiveRitualPanel();
}

async function completeActiveRitualSession(status = "completed") {
  const activeSession = activeRitualSession || getStoredActiveRitualSession();

  if (!activeSession?.id) {
    throw new Error("No active ritual session was found.");
  }

  const user = await getRitualUser();
  if (!user) throw new Error("Sign in to complete this ritual session.");

  const endedAt = new Date().toISOString();
  const finalSnapshot = typeof createAltarSnapshot === "function"
    ? createAltarSnapshot(activeSession.title || "Ritual Session")
    : {};

  const { data: existing, error: readError } = await db
    .from("ritual_sessions")
    .select("event_log, metadata")
    .eq("id", activeSession.id)
    .eq("user_id", user.id)
    .single();

  if (readError) throw readError;

  const eventLog = Array.isArray(existing?.event_log) ? existing.event_log : [];

  const { data, error } = await db
    .from("ritual_sessions")
    .update({
      status,
      ended_at: endedAt,
      altar_snapshot: finalSnapshot || {},
      event_log: [
        ...eventLog,
        {
          type: status === "completed" ? "session_completed" : "session_abandoned",
          occurredAt: endedAt,
          source: "digital_altar"
        }
      ],
      metadata: {
        ...(existing?.metadata || {}),
        companionRunnerVersion: 1
      }
    })
    .eq("id", activeSession.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;

  clearRitualIntervals();
  activeRitualSession = null;
  activeRitualSteps = [];
  storeActiveRitualSession(null);

  document.dispatchEvent(new CustomEvent("saltRitualSessionCompleted", {
    detail: { session: data }
  }));

  ritualPanelView = "home";
  renderRitualHome();

  return data;
}

function renderRitualHome() {
  const { panel, eyebrow, title, content } = getRitualCompanionElements();
  if (!panel || !content) return;

  clearRitualIntervals();
  setRitualPanelMode(true);

  if (eyebrow) eyebrow.textContent = "Ritual Companion";
  if (title) title.textContent = "Begin a Ritual";

  ritualPanelRenderLock = true;
  content.innerHTML = `
    <div class="ritual-companion">
      <div class="ritual-companion-intro">
        <p class="ritual-companion-kicker">Your practice, held gently</p>
        <h3 class="ritual-companion-title">How would you like to begin?</h3>
        <p>Move freely, follow a saved ritual, or begin shaping a new template.</p>
      </div>

      <div class="ritual-launch-options">
        <button type="button" class="ritual-launch-button is-primary" data-ritual-view="free">
          Begin Freely
        </button>
        <button type="button" class="ritual-launch-button" data-ritual-view="templates">
          Choose a Template
        </button>
        <button type="button" class="ritual-launch-button" data-ritual-create-template>
          Create a Template
        </button>
      </div>
    </div>
  `;
  ritualPanelRenderLock = false;
}

function renderFreeRitualForm() {
  const { eyebrow, title, content } = getRitualCompanionElements();
  if (!content) return;

  setRitualPanelMode(true);
  if (eyebrow) eyebrow.textContent = "Ritual Companion";
  if (title) title.textContent = "Begin Freely";

  ritualPanelRenderLock = true;
  content.innerHTML = `
    <div class="ritual-companion">
      <form class="ritual-start-form" data-free-ritual-form>
        <div class="ritual-launch-card">
          <p class="ritual-companion-kicker">Only what feels useful</p>
          <h3 class="ritual-companion-title">Enter the ritual as you are.</h3>
          <p>Both fields are optional. The altar and timing will be recorded quietly in the background.</p>
        </div>

        <label>
          Ritual name
          <input name="title" type="text" placeholder="Untitled Ritual" />
        </label>

        <label>
          Intention
          <textarea name="intention" placeholder="What are you tending, honoring, releasing, or inviting?"></textarea>
        </label>

        <div class="ritual-control-row">
          <button class="ritual-launch-button is-primary" type="submit">Begin Ritual</button>
          <button class="ritual-launch-button" type="button" data-ritual-view="home">Back</button>
        </div>
      </form>
    </div>
  `;
  ritualPanelRenderLock = false;
}

async function renderTemplateList() {
  const { eyebrow, title, content } = getRitualCompanionElements();
  if (!content) return;

  setRitualPanelMode(true);
  if (eyebrow) eyebrow.textContent = "Ritual Companion";
  if (title) title.textContent = "Choose a Template";

  ritualPanelRenderLock = true;
  content.innerHTML = `<p class="ritual-empty-note">Opening your Book of Shadows...</p>`;
  ritualPanelRenderLock = false;

  try {
    const templates = await getRitualTemplates();

    ritualPanelRenderLock = true;
    content.innerHTML = `
      <div class="ritual-companion">
        <div class="ritual-template-list">
          ${templates.length
            ? templates.map((template) => `
              <article class="ritual-template-card">
                <p class="ritual-companion-kicker">${template.ritual_template_steps.length} steps</p>
                <h4>${escapeRitualHtml(template.title)}</h4>
                ${template.intention ? `<p>${escapeRitualHtml(template.intention)}</p>` : ""}
                <button
                  type="button"
                  class="ritual-template-button"
                  data-start-template="${template.id}">
                  Begin This Ritual
                </button>
              </article>
            `).join("")
            : `<p class="ritual-empty-note">No ritual templates have been created yet.</p>`}
        </div>

        <div class="ritual-control-row">
          <button type="button" class="ritual-launch-button" data-ritual-view="home">Back</button>
          <button type="button" class="ritual-launch-button" data-ritual-create-template>Create Template</button>
        </div>
      </div>
    `;
    ritualPanelRenderLock = false;

    content.querySelectorAll("[data-start-template]").forEach((button) => {
      button._ritualTemplate = templates.find((template) => template.id === button.dataset.startTemplate);
    });
  } catch (error) {
    console.error(error);
    content.innerHTML = `<p class="ritual-empty-note">Your templates could not be opened.</p>`;
  }
}

function renderActiveRitualPanel() {
  const { panel, eyebrow, title, content } = getRitualCompanionElements();
  if (!panel || !content || !activeRitualSession) return;

  setRitualPanelMode(true);

  const step = getCurrentRitualStep();
  const completedCount = activeRitualSteps.filter((item) => item.status === "completed" || item.status === "skipped").length;
  const sessionTitle = activeRitualSession.title || "Untitled Ritual";
  const isPaused = activeRitualSession.status === "paused";

  if (eyebrow) eyebrow.textContent = "Ritual in Progress";
  if (title) title.textContent = sessionTitle;

  ritualPanelRenderLock = true;
  content.innerHTML = `
    <div class="ritual-companion">
      <div class="ritual-companion-intro">
        <span class="ritual-session-status ${isPaused ? "is-paused" : ""}">
          ${isPaused ? "Paused" : "In progress"}
        </span>
        ${activeRitualSession.intention
          ? `<p class="ritual-step-instructions"><strong>Intention:</strong> ${escapeRitualHtml(activeRitualSession.intention)}</p>`
          : ""}
        <p class="ritual-session-clock" data-ritual-session-clock>${formatRitualSeconds(getSessionElapsedSeconds())}</p>
      </div>

      ${step ? `
        <section class="ritual-current-step">
          <p class="ritual-step-count">Step ${completedCount + 1} of ${activeRitualSteps.length}</p>
          <h3 class="ritual-companion-title">${escapeRitualHtml(step.title)}</h3>
          ${step.instructions ? `<p class="ritual-step-instructions">${escapeRitualHtml(step.instructions)}</p>` : ""}
          ${step.spoken_text ? `<div class="ritual-spoken-text">${escapeRitualHtml(step.spoken_text)}</div>` : ""}
          ${(step.duration_seconds || step.started_at)
            ? `<div class="ritual-timer" data-ritual-step-clock>${formatRitualSeconds(
                step.duration_seconds
                  ? Math.max(0, Number(step.duration_seconds) - getStepElapsedSeconds(step))
                  : getStepElapsedSeconds(step)
              )}</div>`
            : ""}

          <div class="ritual-step-controls">
            <button type="button" class="ritual-step-button is-primary" data-ritual-complete-step>
              Complete Step
            </button>
            <button type="button" class="ritual-step-button" data-ritual-skip-step>
              Skip
            </button>
          </div>
        </section>
      ` : `
        <section class="ritual-current-step">
          <p class="ritual-companion-kicker">Free ritual</p>
          <h3 class="ritual-companion-title">The space is yours.</h3>
          <p>Move through your practice without prompts. The companion will keep time and preserve the altar state.</p>
        </section>
      `}

      <div class="ritual-control-row">
        <button type="button" class="ritual-control-button" data-ritual-toggle-pause>
          ${isPaused ? "Resume" : "Pause"}
        </button>
        <button type="button" class="ritual-control-button" data-ritual-complete-session>
          Complete Ritual
        </button>
        <button type="button" class="ritual-control-button is-danger" data-ritual-abandon-session>
          End Without Saving
        </button>
      </div>
    </div>
  `;
  ritualPanelRenderLock = false;

  startRitualClocks();
}

function restoreObjectCompanionPanel() {
  clearRitualIntervals();
  setRitualPanelMode(false);

  const { eyebrow, title, content } = getRitualCompanionElements();
  if (eyebrow) eyebrow.textContent = "Companion";
  if (title) title.textContent = "Selected Object";
  if (content) content.innerHTML = "<p>Select an object to see its details.</p>";
}

async function initializeRitualCompanion() {
  try {
    const session = await fetchActiveRitualSession();

    if (session) {
      renderActiveRitualPanel();
      return;
    }

    setRitualPanelMode(false);
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-free-ritual-form]");
  if (!form) return;

  event.preventDefault();

  try {
    const formData = new FormData(form);

    await createFreeRitualSession({
      title: String(formData.get("title") || "").trim(),
      intention: String(formData.get("intention") || "").trim()
    });

    renderActiveRitualPanel();
    showAltarToast("Ritual started");
  } catch (error) {
    console.error(error);
    showAltarToast(error.message || "Ritual could not be started");
  }
});

document.addEventListener(
  "click",
  async (event) => {
    const startButton = event.target.closest('[data-global-action="start-ritual"]');
    const viewButton = event.target.closest("[data-ritual-view]");
    const templateButton = event.target.closest("[data-start-template]");
    const createTemplateButton = event.target.closest("[data-ritual-create-template]");
    const pauseButton = event.target.closest("[data-ritual-toggle-pause]");
    const completeStepButton = event.target.closest("[data-ritual-complete-step]");
    const skipStepButton = event.target.closest("[data-ritual-skip-step]");
    const completeSessionButton = event.target.closest("[data-ritual-complete-session]");
    const abandonSessionButton = event.target.closest("[data-ritual-abandon-session]");

    if (
      !startButton && !viewButton && !templateButton && !createTemplateButton
      && !pauseButton && !completeStepButton && !skipStepButton
      && !completeSessionButton && !abandonSessionButton
    ) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (startButton) {
        if (activeRitualSession || getStoredActiveRitualSession()?.id) {
          await fetchActiveRitualSession();
          renderActiveRitualPanel();
        } else {
          ritualPanelView = "home";
          renderRitualHome();
        }
        return;
      }

      if (viewButton) {
        ritualPanelView = viewButton.dataset.ritualView;

        if (ritualPanelView === "free") renderFreeRitualForm();
        else if (ritualPanelView === "templates") await renderTemplateList();
        else renderRitualHome();
        return;
      }

      if (templateButton) {
        const template = templateButton._ritualTemplate;
        if (!template) throw new Error("That template could not be opened.");

        await createTemplateRitualSession(template);
        renderActiveRitualPanel();
        showAltarToast("Ritual started");
        return;
      }

      if (createTemplateButton) {
        showAltarToast("Template editor comes in Phase 3");
        return;
      }

      if (pauseButton) {
        if (activeRitualSession?.status === "paused") await resumeActiveRitualSession();
        else await pauseActiveRitualSession();
        return;
      }

      if (completeStepButton) {
        await completeCurrentRitualStep();
        return;
      }

      if (skipStepButton) {
        await skipCurrentRitualStep();
        return;
      }

      if (completeSessionButton) {
        await completeActiveRitualSession("completed");
        showAltarToast("Ritual completed");
        return;
      }

      if (abandonSessionButton) {
        const confirmed = window.confirm("End this ritual without saving it as completed?");
        if (!confirmed) return;

        await completeActiveRitualSession("abandoned");
        showAltarToast("Ritual ended");
      }
    } catch (error) {
      console.error(error);
      showAltarToast(error.message || "The ritual companion encountered a problem");
    }
  },
  true
);

document.addEventListener("saltAuthReady", initializeRitualCompanion);
document.addEventListener("saltAuthSuccess", initializeRitualCompanion);

const ritualCompanionObserver = new MutationObserver(() => {
  if (ritualPanelRenderLock || !activeRitualSession) return;

  const { content } = getRitualCompanionElements();
  if (!content?.querySelector(".ritual-companion")) {
    window.requestAnimationFrame(renderActiveRitualPanel);
  }
});

window.setTimeout(() => {
  const { content } = getRitualCompanionElements();

  if (content) {
    ritualCompanionObserver.observe(content, {
      childList: true,
      subtree: true
    });
  }

  initializeRitualCompanion();
}, 700);
