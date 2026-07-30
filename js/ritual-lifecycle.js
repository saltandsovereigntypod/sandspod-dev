(function initializeRitualLifecycle(global) {
  "use strict";

  const VERSION = 1;
  const STORAGE_PREFIX = "saltAndSovereigntyRitualLifecycle";
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const timestamp = (clock = () => new Date().toISOString()) => clock();
  const randomId = () => global.crypto?.randomUUID?.() || `ritual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const CANDLE_END_BEHAVIORS = Object.freeze(["keep_burning", "extinguish_at_end", "ask_at_end"]);
  const normalizeCandleEndBehavior = (value) => CANDLE_END_BEHAVIORS.includes(value) ? value : "ask_at_end";

  function eventIdentity(event = {}) {
    return event.idempotencyKey || [event.type, event.stepId || "", event.journalId || "", event.occurredAt || ""].join(":");
  }

  function appendEvent(session, event, clock) {
    const next = clone(session);
    const candidate = { occurredAt: timestamp(clock), ...clone(event) };
    const identity = eventIdentity(candidate);
    next.event_log = Array.isArray(next.event_log) ? next.event_log : [];
    if (!next.event_log.some((existing) => eventIdentity(existing) === identity)) next.event_log.push(candidate);
    next.updated_at = timestamp(clock);
    return next;
  }

  function snapshotTemplate(template = {}) {
    return Object.freeze(clone({
      id: template.id || null,
      title: template.title || template.name || "Untitled Ritual",
      description: template.description || "",
      intention: template.intention || "",
      linked_altar_id: template.linked_altar_id || null,
      estimated_duration_seconds: Math.max(0, Number(template.estimated_duration_seconds || 0)),
      candle_end_behavior: normalizeCandleEndBehavior(template.candle_end_behavior || template.settings?.candle_end_behavior),
      linked_entities: template.linked_entities || [],
      suggested_objects: template.suggested_objects || [],
      suggested_apothecary_items: template.suggested_apothecary_items || [],
      steps: (template.ritual_template_steps || template.steps || []).map((step, index) => ({
        template_step_id: step.id || null,
        sort_order: Number.isFinite(step.sort_order) ? step.sort_order : index,
        title: step.title || `Step ${index + 1}`,
        instructions: step.instructions || "",
        spoken_text: step.spoken_text || "",
        duration_seconds: Number(step.duration_seconds || 0),
        completion_mode: step.completion_mode || "manual",
        actions: clone(step.actions || []),
        linked_entities: clone(step.linked_entities || []),
        metadata: clone(step.metadata || {})
      }))
    }));
  }

  function createSession(template = {}, options = {}) {
    const now = timestamp(options.clock);
    const snapshot = snapshotTemplate(template);
    const id = (options.idFactory || randomId)();
    const steps = snapshot.steps.map((step, index) => ({
      ...clone(step), id: (options.idFactory || randomId)(), session_id: id,
      status: index === 0 ? "active" : "pending", started_at: index === 0 ? now : null,
      completed_at: null, elapsed_seconds: 0
    }));
    return {
      id, user_id: options.userId || null, scope: options.scope || (options.userId ? `user:${options.userId}` : "guest"),
      template_id: snapshot.id, title: snapshot.title, intention: snapshot.intention || null,
      source: snapshot.id ? "template" : "digital_altar", status: "active", started_at: now,
      ended_at: null, completed_at: null, current_step_order: 0,
      template_snapshot: clone(snapshot), session_steps: steps, linked_entities: clone(snapshot.linked_entities),
      prepared_objects: clone(options.preparedObjects || []), altar_snapshot: clone(options.altarSnapshot || {}),
      candle_end_behavior: normalizeCandleEndBehavior(options.candleEndBehavior || snapshot.candle_end_behavior),
      candle_end_handled_at: null,
      reflection: "", grimoire_page_id: null, created_at: now, updated_at: now,
      event_log: [{ type: "session_started", occurredAt: now, templateId: snapshot.id, idempotencyKey: `session_started:${id}` }],
      lifecycle_version: VERSION
    };
  }

  function completeSession(session, options = {}) {
    if (!session) throw new Error("A ritual session is required.");
    if (session.status === "completed") return clone(session);
    const now = timestamp(options.clock);
    let next = { ...clone(session), status: "completed", ended_at: now, completed_at: now, updated_at: now };
    if (options.altarSnapshot) next.altar_snapshot = clone(options.altarSnapshot);
    next = appendEvent(next, { type: "session_completed", occurredAt: now, idempotencyKey: `session_completed:${session.id}` }, options.clock);
    return next;
  }

  function saveReflection(session, reflection, clock) {
    const text = String(reflection || "").trim();
    let next = { ...clone(session), reflection: text, updated_at: timestamp(clock) };
    return appendEvent(next, { type: "reflection_saved", idempotencyKey: `reflection_saved:${session.id}:${text}` }, clock);
  }

  function upsertJournal(journals = [], session, values = {}, options = {}) {
    const copy = clone(journals);
    const existingIndex = copy.findIndex((journal) => journal.session_id === session.id);
    const existing = existingIndex >= 0 ? copy[existingIndex] : null;
    const now = timestamp(options.clock);
    const journal = {
      ...existing, ...clone(values), id: existing?.id || (options.idFactory || randomId)(),
      session_id: session.id, template_id: session.template_id || null,
      title: values.title || session.title, reflection: values.reflection ?? session.reflection ?? "",
      created_at: existing?.created_at || now, updated_at: now
    };
    if (existingIndex >= 0) copy[existingIndex] = journal; else copy.push(journal);
    return { journals: copy, journal, created: existingIndex < 0 };
  }

  function newestRecord(local, remote) {
    if (!local) return clone(remote); if (!remote) return clone(local);
    return Date.parse(local.updated_at || local.created_at || 0) >= Date.parse(remote.updated_at || remote.created_at || 0) ? clone(local) : clone(remote);
  }

  function normalizeRitualLink(link = {}) {
    const metadata = link.metadata && typeof link.metadata === "object" && !Array.isArray(link.metadata)
      ? clone(link.metadata)
      : {};
    return { ...clone(link), metadata };
  }

  function ritualLinkIdentity(link = {}) {
    return [link.link_type, link.entity_id || "", link.object_instance_id || "", link.apothecary_item_id || "", link.grimoire_page_id || "", link.saved_altar_id || ""].join(":");
  }

  function uniqueRitualLinks(links = [], existingLinks = []) {
    const existing = new Set(existingLinks.map(ritualLinkIdentity));
    const next = [];
    links.map(normalizeRitualLink).forEach((link) => {
      const identity = ritualLinkIdentity(link);
      if (!existing.has(identity)) { existing.add(identity); next.push(link); }
    });
    return next;
  }

  function createLocalRepository(storage, scope = "guest") {
    const key = `${STORAGE_PREFIX}:${scope}`;
    const read = () => { try { return JSON.parse(storage.getItem(key)) || { version: VERSION, activeSessionId: null, sessions: [], journals: [] }; } catch { return { version: VERSION, activeSessionId: null, sessions: [], journals: [] }; } };
    const write = (state) => { storage.setItem(key, JSON.stringify(state)); return clone(state); };
    return {
      key, read,
      getActive() { const state = read(); return clone(state.sessions.find((item) => item.id === state.activeSessionId && ["active", "paused"].includes(item.status)) || null); },
      saveSession(session, active = ["active", "paused"].includes(session.status)) { const state = read(); const index = state.sessions.findIndex((item) => item.id === session.id); if (index >= 0) state.sessions[index] = clone(session); else state.sessions.push(clone(session)); state.activeSessionId = active ? session.id : state.activeSessionId === session.id ? null : state.activeSessionId; write(state); return clone(session); },
      start(template, options = {}) { if (this.getActive()) throw new Error("A ritual session is already active."); const session = createSession(template, { ...options, scope }); return this.saveSession(session, true); },
      complete(id, options = {}) { const state = read(); const index = state.sessions.findIndex((item) => item.id === id); if (index < 0) throw new Error("Ritual session not found."); state.sessions[index] = completeSession(state.sessions[index], options); if (state.activeSessionId === id) state.activeSessionId = null; write(state); return clone(state.sessions[index]); },
      deleteSession(id) { const state = read(); state.sessions = state.sessions.filter((item) => item.id !== id); if (state.activeSessionId === id) state.activeSessionId = null; return write(state); },
      upsertJournal(session, values, options) { const state = read(); const result = upsertJournal(state.journals, session, values, options); state.journals = result.journals; write(state); return clone(result); },
      deleteJournal(id) { const state = read(); state.journals = state.journals.filter((item) => item.id !== id); return write(state); }
    };
  }

  function linkedCandleWarnings(candles = [], estimatedDurationSeconds = 0, now = Date.now()) {
    if (!global.CandleLifecycle) return [];
    return global.CandleLifecycle.ritualWarnings(candles, Math.max(0, Number(estimatedDurationSeconds) || 0) * 1000, now);
  }

  const api = { VERSION, STORAGE_PREFIX, CANDLE_END_BEHAVIORS, normalizeCandleEndBehavior, appendEvent, snapshotTemplate, createSession, completeSession, saveReflection, upsertJournal, newestRecord, normalizeRitualLink, ritualLinkIdentity, uniqueRitualLinks, linkedCandleWarnings, createLocalRepository };
  global.RitualLifecycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
