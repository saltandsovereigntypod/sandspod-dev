(function initializeCandleLifecycle(global) {
  "use strict";

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const MAX_EXPECTED_MS = 365 * DAY;
  const END_BEHAVIORS = Object.freeze(["keep_burning", "extinguish_at_end", "ask_at_end"]);
  const FORMS = Object.freeze({
    "chime-spell": Object.freeze({ form: "chime-spell", label: "Chime / Spell Candle", defaultBurnMs: 2 * HOUR, sourceNote: "Approximate small spell-candle life; size and maker vary.", editableBeforeFirstLight: true }),
    taper: Object.freeze({ form: "taper", label: "Taper Candle", defaultBurnMs: 8 * HOUR, sourceNote: "Approximate standard taper life; size and maker vary.", editableBeforeFirstLight: true }),
    "tea-light": Object.freeze({ form: "tea-light", label: "Tea Light", defaultBurnMs: 4 * HOUR, sourceNote: "Approximate standard tea-light life; size and maker vary.", editableBeforeFirstLight: true }),
    pillar: Object.freeze({ form: "pillar", label: "Pillar Candle", defaultBurnMs: 60 * HOUR, sourceNote: "Approximate medium pillar life; diameter and maker vary.", editableBeforeFirstLight: true }),
    vigil: Object.freeze({ form: "vigil", label: "Vigil Candle", defaultBurnMs: 7 * DAY, sourceNote: "Approximate seven-day vigil life; actual continuous life varies.", editableBeforeFirstLight: true })
  });

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const validTime = (value) => Number.isFinite(Date.parse(value || ""));
  const iso = (value = Date.now()) => new Date(value).toISOString();
  const eventId = (instanceId, startedAt) => `candle-burn:${instanceId || "unscoped"}:${startedAt}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function formDefinition(form) {
    return FORMS[String(form || "").toLowerCase()] || null;
  }

  function uniqueHistory(records = []) {
    const byId = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
      if (!record || !validTime(record.litAt || record.startedAt) || !validTime(record.extinguishedAt || record.endedAt)) return;
      const litAt = record.litAt || record.startedAt;
      const extinguishedAt = record.extinguishedAt || record.endedAt;
      const id = record.eventId || record.id || eventId(record.instanceId, litAt);
      const durationMs = Math.max(0, Number(record.durationMs) || Date.parse(extinguishedAt) - Date.parse(litAt));
      if (!byId.has(id)) byId.set(id, {
        eventId: id, litAt, extinguishedAt, durationMs,
        endReason: record.endReason || record.reason || "other",
        ritualId: record.ritualId || "", altarId: record.altarId || "",
        instanceId: record.instanceId || ""
      });
    });
    return [...byId.values()].sort((a, b) => Date.parse(a.litAt) - Date.parse(b.litAt));
  }

  function normalize(state = {}, options = {}) {
    const input = state && typeof state === "object" ? clone(state) : {};
    const form = String(input.form || options.form || "").toLowerCase();
    const definition = formDefinition(form);
    const explicitExpected = Number(input.expectedBurnMs);
    const expectedBurnMs = explicitExpected > 0
      ? clamp(explicitExpected, 1, MAX_EXPECTED_MS)
      : definition?.defaultBurnMs || 0;
    const burnHistory = uniqueHistory(input.burnHistory);
    const historicalTotal = burnHistory.reduce((sum, record) => sum + record.durationMs, 0);
    const totalBurnMs = expectedBurnMs
      ? clamp(Math.max(Number(input.totalBurnMs) || 0, historicalTotal), 0, expectedBurnMs)
      : Math.max(0, Number(input.totalBurnMs) || 0, historicalTotal);
    const permanentlySpent = Boolean(input.spentAt) || input.status === "spent" || (expectedBurnMs > 0 && totalBurnMs >= expectedBurnMs);
    const archived = Boolean(input.archived) || input.status === "archived";
    const currentBurnStartedAt = !permanentlySpent && !archived && validTime(input.currentBurnStartedAt)
      ? input.currentBurnStartedAt : "";
    const status = archived ? "archived" : permanentlySpent ? "spent" : currentBurnStartedAt ? "burning" : "unlit";
    return {
      version: 2, form, expectedBurnMs,
      durationLocked: Boolean(input.durationLocked || input.firstLitAt || burnHistory.length || currentBurnStartedAt || permanentlySpent),
      firstLitAt: validTime(input.firstLitAt) ? input.firstLitAt : burnHistory[0]?.litAt || currentBurnStartedAt || "",
      totalBurnMs, currentBurnStartedAt,
      lastLitAt: validTime(input.lastLitAt) ? input.lastLitAt : currentBurnStartedAt || burnHistory.at(-1)?.litAt || "",
      estimatedBurnoutAt: currentBurnStartedAt && expectedBurnMs
        ? iso(Date.parse(currentBurnStartedAt) + Math.max(0, expectedBurnMs - totalBurnMs)) : "",
      spentAt: permanentlySpent ? (validTime(input.spentAt) ? input.spentAt : burnHistory.at(-1)?.extinguishedAt || "") : "",
      status, archived,
      replacedByInstanceId: String(input.replacedByInstanceId || ""),
      replacesInstanceId: String(input.replacesInstanceId || ""),
      burnHistory,
      durationHistory: Array.isArray(input.durationHistory) ? clone(input.durationHistory) : [],
      dressings: Array.isArray(input.dressings) ? clone(input.dressings) : [],
      burnoutNotificationEventId: String(input.burnoutNotificationEventId || "")
    };
  }

  function setExpectedDuration(state, expectedBurnMs, options = {}) {
    const candle = normalize(state, options);
    if (candle.durationLocked) throw new Error("Candle life is locked after first lighting.");
    const nextMs = Number(expectedBurnMs);
    if (!Number.isFinite(nextMs) || nextMs <= 0 || nextMs > MAX_EXPECTED_MS) {
      throw new Error("Choose a candle life between one millisecond and 365 days.");
    }
    candle.durationHistory.push({ changedAt: iso(options.now), fromMs: candle.expectedBurnMs, toMs: nextMs });
    candle.expectedBurnMs = nextMs;
    return candle;
  }

  function reconcile(state, now = Date.now(), context = {}) {
    const candle = normalize(state, context);
    if (candle.status !== "burning") return { candle, changed: false, burnedOut: false, notificationNeeded: false };
    const startedMs = Date.parse(candle.currentBurnStartedAt);
    const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.parse(now);
    if (!Number.isFinite(startedMs) || !Number.isFinite(nowMs) || nowMs < startedMs) {
      return { candle, changed: false, burnedOut: false, notificationNeeded: false, warning: "clock_invalid" };
    }
    const remaining = Math.max(0, candle.expectedBurnMs - candle.totalBurnMs);
    if (nowMs - startedMs < remaining) return { candle, changed: false, burnedOut: false, notificationNeeded: false };
    return extinguish(candle, startedMs + remaining, "candle_life_reached", context);
  }

  function light(state, now = Date.now(), context = {}) {
    let candle = normalize(state, context);
    const reconciled = reconcile(candle, now, context);
    candle = reconciled.candle;
    if (candle.status === "spent") throw new Error("This candle is spent and needs replacement.");
    if (candle.status === "archived") throw new Error("Archived candles cannot be lit.");
    if (!candle.expectedBurnMs) throw new Error("Choose an expected candle life before lighting.");
    if (candle.status === "burning") return { candle, changed: reconciled.changed, duplicate: true };
    const time = iso(now);
    candle.durationLocked = true;
    candle.firstLitAt ||= time;
    candle.lastLitAt = time;
    candle.currentBurnStartedAt = time;
    candle.estimatedBurnoutAt = iso(Date.parse(time) + candle.expectedBurnMs - candle.totalBurnMs);
    candle.status = "burning";
    return { candle, changed: true, duplicate: false };
  }

  function extinguish(state, now = Date.now(), reason = "manual_extinguish", context = {}) {
    const candle = normalize(state, context);
    if (candle.status !== "burning" || !validTime(candle.currentBurnStartedAt)) {
      return { candle, changed: false, duplicate: true, burnedOut: candle.status === "spent", notificationNeeded: false };
    }
    const startedMs = Date.parse(candle.currentBurnStartedAt);
    const requestedEnd = Number.isFinite(Number(now)) ? Number(now) : Date.parse(now);
    const remaining = Math.max(0, candle.expectedBurnMs - candle.totalBurnMs);
    const elapsed = Math.max(0, requestedEnd - startedMs);
    const durationMs = Math.min(elapsed, remaining);
    const endedMs = startedMs + durationMs;
    const id = eventId(context.instanceId, candle.currentBurnStartedAt);
    if (!candle.burnHistory.some((record) => record.eventId === id)) {
      candle.burnHistory.push({
        eventId: id, litAt: candle.currentBurnStartedAt, extinguishedAt: iso(endedMs), durationMs,
        endReason: durationMs >= remaining ? "candle_life_reached" : reason,
        ritualId: context.ritualId || "", altarId: context.altarId || "", instanceId: context.instanceId || ""
      });
    }
    candle.totalBurnMs = Math.min(candle.expectedBurnMs, candle.totalBurnMs + durationMs);
    candle.currentBurnStartedAt = "";
    candle.estimatedBurnoutAt = "";
    const burnedOut = candle.totalBurnMs >= candle.expectedBurnMs;
    candle.status = burnedOut ? "spent" : "unlit";
    candle.spentAt = burnedOut ? iso(endedMs) : "";
    const notificationNeeded = burnedOut && candle.burnoutNotificationEventId !== id;
    return { candle, changed: true, burnedOut, notificationNeeded, burnoutEventId: burnedOut ? id : "" };
  }

  function remainingMs(state, now = Date.now(), context = {}) {
    const candle = normalize(state, context);
    const live = candle.status === "burning" && validTime(candle.currentBurnStartedAt)
      ? Math.max(0, Number(now) - Date.parse(candle.currentBurnStartedAt)) : 0;
    return Math.max(0, candle.expectedBurnMs - candle.totalBurnMs - live);
  }

  function fresh(form, options = {}) {
    return normalize({ form, expectedBurnMs: options.expectedBurnMs || formDefinition(form)?.defaultBurnMs || 0, replacesInstanceId: options.replacesInstanceId || "", dressings: options.dressings || [] }, { form });
  }

  function archive(state, replacementId = "") {
    const candle = normalize(state);
    candle.archived = true;
    candle.status = "archived";
    candle.currentBurnStartedAt = "";
    candle.estimatedBurnoutAt = "";
    candle.replacedByInstanceId = replacementId;
    return candle;
  }

  function formatDuration(milliseconds) {
    const minutes = Math.max(0, Math.ceil(Number(milliseconds || 0) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return [days && `${days}d`, hours && `${hours}h`, (!days && mins || (!days && !hours)) && `${mins}m`].filter(Boolean).join(" ");
  }

  function ritualWarnings(candles = [], estimatedDurationMs = 0, now = Date.now()) {
    return candles.filter((item) => item?.ritualIncluded === true).map((item) => {
      const remaining = remainingMs(item.candle, now, { form: item.form });
      return remaining < estimatedDurationMs ? { instanceId: item.instanceId, label: item.label || "Candle", remainingMs: remaining, estimatedDurationMs, spent: remaining === 0 } : null;
    }).filter(Boolean);
  }

  const api = { VERSION: 2, FORMS, MAX_EXPECTED_MS, END_BEHAVIORS, formDefinition, normalize, setExpectedDuration, light, extinguish, reconcile, remainingMs, fresh, archive, formatDuration, ritualWarnings, eventId };
  global.CandleLifecycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document === "undefined") return;

  let schedulerId = 0;
  const objectContext = (object) => ({ form: object.dataset.form || "", instanceId: object.dataset.altarObjectId || "", ritualId: global.activeRitualSession?.id || "", altarId: global.currentSavedAltarId || "" });
  const stateFor = (object) => global.getLivingObjectState?.(object)?.candle || {};
  function applyVisual(object, candle) {
    object.dataset.lit = candle.status === "burning" ? "true" : "false";
    object.classList.toggle("is-lit", candle.status === "burning");
    object.classList.toggle("is-candle-spent", candle.status === "spent");
    object.dataset.candleStatus = candle.status;
    if (candle.status === "burning") global.startFlame?.(object); else global.stopFlame?.(object);
  }
  function persist(object, candle, silent = false) {
    const state = global.getLivingObjectState?.(object);
    if (!state) return;
    state.candle = candle;
    global.saveLivingObjectState?.(object, state, { silent });
    applyVisual(object, candle);
    const instanceId = object.dataset.instanceId;
    if (instanceId && typeof global.getObjectInstance === "function" && typeof global.updateObjectInstance === "function") {
      global.getObjectInstance(instanceId).then((instance) => instance && global.updateObjectInstance(instanceId, {
        status: candle.archived ? "archived" : candle.status === "spent" ? "spent" : "active",
        remaining_burn_seconds: Math.floor(remainingMs(candle) / 1000),
        total_burn_seconds: Math.floor(candle.totalBurnMs / 1000),
        metadata: { ...(instance.metadata || {}), candleLifecycle: candle }
      })).catch(() => global.showAltarToast?.("Candle life is saved on this device and will sync when cloud access returns."));
    }
  }
  function notifyBurnout(object, result) {
    if (!result.notificationNeeded) return;
    const label = object.dataset.label || "Candle";
    global.showAltarToast?.(`The ${label} has reached the end of its candle life and has extinguished.`);
    result.candle.burnoutNotificationEventId = result.burnoutEventId;
    persist(object, result.candle);
  }
  function reconcileObject(object, options = {}) {
    if (object?.dataset.type !== "candle") return null;
    const result = reconcile(stateFor(object), options.now || Date.now(), objectContext(object));
    applyVisual(object, result.candle);
    if (result.changed) persist(object, result.candle, Boolean(options.silent));
    notifyBurnout(object, result);
    schedule();
    return result;
  }
  function lightObject(object) {
    try {
      const result = light(stateFor(object), Date.now(), objectContext(object));
      if (result.changed) persist(object, result.candle);
      schedule();
      return result;
    } catch (error) { global.showAltarToast?.(error.message); return null; }
  }
  function extinguishObject(object, reason = "manual_extinguish", options = {}) {
    const result = extinguish(stateFor(object), Date.now(), reason, { ...objectContext(object), ...options });
    if (result.changed) {
      persist(object, result.candle);
      global.extinguishFlame?.(object);
      if (options.showSummary !== false) showSummary();
    }
    notifyBurnout(object, result);
    schedule();
    return result;
  }
  function setObjectDuration(object, expectedBurnMs) {
    try { const candle = setExpectedDuration(stateFor(object), expectedBurnMs, objectContext(object)); persist(object, candle); return candle; }
    catch (error) { global.showAltarToast?.(error.message); return null; }
  }
  function replaceObject(object) {
    if (object?.dataset.type !== "candle") return null;
    const oldCandle = normalize(stateFor(object), objectContext(object));
    if (oldCandle.status !== "spent") { global.showAltarToast?.("Only a spent candle needs replacement."); return null; }
    if (!global.confirm("Replace this spent candle? Its burn history will be archived, and the fresh candle will be undressed.")) return null;
    const oldId = object.dataset.altarObjectId || "";
    const placement = { left: object.style.left, top: object.style.top, zIndex: object.style.zIndex, scale: object.dataset.scale, rotation: object.dataset.rotation, flipped: object.dataset.flipped };
    try {
      global.duplicateObject?.(object);
      const replacement = document.querySelector('.altar-object.is-selected[data-type="candle"]');
      if (!replacement || replacement === object) throw new Error("replacement_not_created");
      const newId = replacement.dataset.altarObjectId || "";
      const replacementState = global.getLivingObjectState?.(replacement);
      replacementState.candle = fresh(replacement.dataset.form, { replacesInstanceId: oldId, dressings: [] });
      replacement.style.left = placement.left;
      replacement.style.top = placement.top;
      replacement.style.zIndex = placement.zIndex;
      replacement.dataset.scale = placement.scale;
      replacement.dataset.rotation = placement.rotation;
      replacement.dataset.flipped = placement.flipped;
      replacement.dataset.lit = "false";
      global.saveLivingObjectState?.(replacement, replacementState);
      global.updateObjectTransform?.(replacement);
      global.updateCandleDressingVisuals?.(replacement);
      const archivedCandle = archive(oldCandle, newId);
      const archiveKey = "saltAndSovereigntyArchivedCandles:v1";
      let records = [];
      try { records = JSON.parse(localStorage.getItem(archiveKey) || "[]"); } catch { records = []; }
      records.push({ instanceId: oldId, label: object.dataset.label || "Candle", archivedAt: iso(), candle: archivedCandle });
      localStorage.setItem(archiveKey, JSON.stringify(records.slice(-250)));
      persist(object, archivedCandle, true);
      object.remove();
      global.saveWorkingAltarDraft?.();
      global.showAltarToast?.("The spent candle was archived and replaced with a fresh, undressed candle.");
      schedule();
      return replacement;
    } catch {
      global.showAltarToast?.("That candle could not be replaced. The original candle remains available.");
      return null;
    }
  }
  function schedule() {
    clearTimeout(schedulerId);
    const burning = [...document.querySelectorAll('.altar-object[data-type="candle"]')]
      .map((object) => ({ object, candle: normalize(stateFor(object), objectContext(object)), context: objectContext(object) }))
      .filter(({ candle }) => candle.status === "burning");
    if (!burning.length) { schedulerId = 0; return; }
    const nearest = Math.min(...burning.map(({ candle }) => Date.parse(candle.estimatedBurnoutAt) || Date.now() + 60000));
    schedulerId = global.setTimeout(() => { burning.forEach(({ object }) => reconcileObject(object)); }, Math.max(250, Math.min(60000, nearest - Date.now())));
  }
  function showSummary() {
    const candles = [...document.querySelectorAll('.altar-object[data-type="candle"]')];
    let dialog = document.querySelector("[data-candle-life-summary]");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "candle-life-summary";
      dialog.dataset.candleLifeSummary = "";
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<h2>Remaining candle life on this Altar</h2><div class="candle-life-summary__rows">${candles.map((object) => { const candle = normalize(stateFor(object), objectContext(object)); return `<div><strong>${String(object.dataset.label || "Candle").replace(/[<>&]/g, "")}</strong><span>${formatDuration(remainingMs(candle))}${candle.status === "spent" ? " · Spent" : ""}</span></div>`; }).join("")}</div><button type="button" class="button button--secondary" data-close-candle-summary>Close</button>`;
    dialog.querySelector("[data-close-candle-summary]").onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
  }
  function companionMarkup(object) {
    if (object?.dataset.type !== "candle") return "";
    const result = reconcileObject(object, { silent: true });
    const candle = result?.candle || normalize(stateFor(object), objectContext(object));
    return `<section class="companion-v3-section candle-life-card"><h3>Candle Life</h3><dl><div><dt>Form</dt><dd>${formDefinition(candle.form)?.label || candle.form || "Custom"}</dd></div><div><dt>Expected life</dt><dd>${formatDuration(candle.expectedBurnMs)}</dd></div><div><dt>Burned</dt><dd>${formatDuration(candle.totalBurnMs)}</dd></div><div><dt>Remaining</dt><dd>${formatDuration(remainingMs(candle))}</dd></div><div><dt>Status</dt><dd>${candle.status === "spent" ? "Spent — Needs replacement" : candle.status}</dd></div><div><dt>Last lit</dt><dd>${candle.lastLitAt ? new Date(candle.lastLitAt).toLocaleString() : "Never"}</dd></div>${candle.status === "burning" ? `<div><dt>Estimated burnout</dt><dd>${new Date(candle.estimatedBurnoutAt).toLocaleString()}</dd></div>` : ""}</dl>${!candle.durationLocked ? `<button type="button" class="button button--tiny" data-edit-candle-duration>Edit expected life</button>` : ""}${candle.status === "spent" ? `<p><strong>Needs replacement</strong></p>` : ""}<details><summary>Burn history (${candle.burnHistory.length})</summary><ul>${candle.burnHistory.map((record) => `<li>${new Date(record.litAt).toLocaleString()} · ${formatDuration(record.durationMs)} · ${String(record.endReason).replaceAll("_", " ")}</li>`).join("") || "<li>No completed burns yet.</li>"}</ul></details></section>`;
  }
  function openDurationEditor(object, trigger) {
    const current = normalize(stateFor(object), objectContext(object));
    if (current.durationLocked) { global.showAltarToast?.("Candle life is locked after first lighting."); return; }
    let dialog = document.querySelector("[data-candle-duration-dialog]");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "candle-life-summary";
      dialog.dataset.candleDurationDialog = "";
      document.body.appendChild(dialog);
    }
    const totalMinutes = Math.round(current.expectedBurnMs / 60000);
    dialog.innerHTML = `<form method="dialog"><h2>Edit expected candle life</h2><p>Physical candles vary. This approximation locks permanently when first lit.</p><div class="candle-duration-fields"><label>Days<input name="days" type="number" min="0" max="365" value="${Math.floor(totalMinutes / 1440)}"></label><label>Hours<input name="hours" type="number" min="0" max="23" value="${Math.floor((totalMinutes % 1440) / 60)}"></label><label>Minutes<input name="minutes" type="number" min="0" max="59" value="${totalMinutes % 60}"></label></div><div><button type="submit" class="button" value="save">Save expected life</button>${formDefinition(current.form) ? `<button type="submit" class="button button--secondary" value="default">Use form default</button>` : ""}<button type="submit" class="button button--secondary" value="cancel">Cancel</button></div></form>`;
    dialog.onclose = () => {
      if (dialog.returnValue === "save") {
        const data = new FormData(dialog.querySelector("form"));
        const duration = (Number(data.get("days")) * 1440 + Number(data.get("hours")) * 60 + Number(data.get("minutes"))) * 60000;
        setObjectDuration(object, duration);
      } else if (dialog.returnValue === "default") {
        setObjectDuration(object, formDefinition(current.form).defaultBurnMs);
      }
      trigger?.focus?.();
    };
    dialog.returnValue = "cancel";
    dialog.showModal();
    dialog.querySelector("input")?.focus();
  }
  global.reconcileCandleObject = reconcileObject;
  global.lightCandleObject = lightObject;
  global.extinguishCandleObject = extinguishObject;
  global.setCandleExpectedDuration = setObjectDuration;
  global.replaceCandleObject = replaceObject;
  global.showCandleLifeSummary = showSummary;
  global.renderCandleLifeCompanion = companionMarkup;
  global.getCandleRitualWarnings = (estimatedMs) => ritualWarnings([...document.querySelectorAll('.altar-object[data-type="candle"]')].map((object) => ({ instanceId: object.dataset.altarObjectId, label: object.dataset.label, form: object.dataset.form, ritualIncluded: object.dataset.ritualIncluded === "true", candle: stateFor(object) })), estimatedMs);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) document.querySelectorAll('.altar-object[data-type="candle"]').forEach((object) => reconcileObject(object)); });
  global.addEventListener("focus", () => document.querySelectorAll('.altar-object[data-type="candle"]').forEach((object) => reconcileObject(object)));
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-edit-candle-duration]")) return;
    const object = document.querySelector('.altar-object.is-selected[data-type="candle"]');
    if (!object) return;
    openDurationEditor(object, event.target.closest("[data-edit-candle-duration]"));
  });
  document.addEventListener("living-object-state:changed", schedule);
  document.addEventListener("DOMContentLoaded", () => { document.querySelectorAll('.altar-object[data-type="candle"]').forEach((object) => reconcileObject(object)); schedule(); }, { once: true });
})(typeof window !== "undefined" ? window : globalThis);
