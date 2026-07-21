/* =========================================================
   RITUAL SYSTEM FOUNDATION
   Dev foundation for templates, sessions, journal links, and altar snapshots
   ========================================================= */

const ACTIVE_RITUAL_SESSION_KEY = "saltAndSovereigntyActiveRitualSession";

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

async function getRitualUser() {
  if (typeof currentUser !== "undefined" && currentUser) {
    return currentUser;
  }

  const { data, error } = await db.auth.getUser();

  if (error) throw error;
  return data.user || null;
}

async function createFreeRitualSession({ title = "", intention = "" } = {}) {
  const user = await getRitualUser();

  if (!user) {
    throw new Error("Sign in to begin a saved ritual session.");
  }

  const altarSnapshot =
    typeof createAltarSnapshot === "function"
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
      event_log: [
        {
          type: "session_started",
          occurredAt: new Date().toISOString(),
          source: "digital_altar"
        }
      ]
    })
    .select("*")
    .single();

  if (error) throw error;

  storeActiveRitualSession({
    id: data.id,
    title: data.title || "Untitled Ritual",
    startedAt: data.started_at
  });

  document.dispatchEvent(
    new CustomEvent("saltRitualSessionStarted", {
      detail: { session: data }
    })
  );

  return data;
}

async function completeActiveRitualSession() {
  const activeSession = getStoredActiveRitualSession();

  if (!activeSession?.id) {
    throw new Error("No active ritual session was found.");
  }

  const user = await getRitualUser();

  if (!user) {
    throw new Error("Sign in to complete this ritual session.");
  }

  const endedAt = new Date().toISOString();
  const finalSnapshot =
    typeof createAltarSnapshot === "function"
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
      status: "completed",
      ended_at: endedAt,
      altar_snapshot: finalSnapshot || {},
      event_log: [
        ...eventLog,
        {
          type: "session_completed",
          occurredAt: endedAt,
          source: "digital_altar"
        }
      ],
      metadata: {
        ...(existing?.metadata || {}),
        foundationTestCompleted: true
      }
    })
    .eq("id", activeSession.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;

  storeActiveRitualSession(null);

  document.dispatchEvent(
    new CustomEvent("saltRitualSessionCompleted", {
      detail: { session: data }
    })
  );

  return data;
}

async function handleRitualFoundationStart() {
  const activeSession = getStoredActiveRitualSession();

  if (activeSession?.id) {
    const shouldComplete = window.confirm(
      `A ritual session is active: ${activeSession.title}. Complete it now?`
    );

    if (!shouldComplete) return;

    await completeActiveRitualSession();
    showAltarToast("Ritual session completed");
    return;
  }

  const title = window.prompt("Name this ritual, or leave it blank:", "") || "";
  const intention = window.prompt("Set an intention, or leave it blank:", "") || "";

  await createFreeRitualSession({
    title: title.trim(),
    intention: intention.trim()
  });

  showAltarToast("Ritual session started");
}

document.addEventListener(
  "click",
  async (event) => {
    const startButton = event.target.closest('[data-global-action="start-ritual"]');

    if (!startButton) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      await handleRitualFoundationStart();
    } catch (error) {
      console.error(error);
      showAltarToast(error.message || "Ritual session could not be started");
    }
  },
  true
);
