(function initializeAltarSaveModes(global) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uuid = () => global.crypto?.randomUUID?.() || `altar-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const HISTORY_KEYS = new Set([
    "events", "eventHistory", "usageHistory", "cleansingHistory", "chargingHistory",
    "offeringHistory", "tendingHistory", "ritualHistory", "lastUsedAt", "archivedAt",
    "currentRitualId", "currentRitualName", "ritualId", "ritualName", "notes"
  ]);

  function freshLivingState(raw, object) {
    let state = {};
    try { state = typeof raw === "string" ? JSON.parse(raw || "{}") : clone(raw || {}); } catch { state = {}; }
    Object.keys(state).forEach((key) => { if (HISTORY_KEYS.has(key) || /history|lastUsed|archiv|ritual/i.test(key)) delete state[key]; });
    state.lifecycle = { ...(state.lifecycle || {}), status: "active", archivedAt: "", replacedByInstanceId: "", replacesInstanceId: "" };
    state.crystal = { ...(state.crystal || {}), cleansingHistory: [], chargingHistory: [], lastCleansedAt: "", lastChargedAt: "" };
    state.deity = { ...(state.deity || {}), offerings: [], offeringStatusHistory: [], lastOfferingAt: "", offeringStatus: "" };
    state.apothecary = { ...(state.apothecary || {}), tendingHistory: [], lastTendedAt: "", nextTendingAt: "" };
    state.ritualIncluded = false;
    if (object.type === "candle") {
      const candle = typeof global.createFreshCandleLifecycle === "function"
        ? global.createFreshCandleLifecycle(object.form)
        : { version: 2, form: object.form || "", expectedBurnMs: 0, durationLocked: false, firstLitAt: "", totalBurnMs: 0, currentBurnStartedAt: "", lastLitAt: "", estimatedBurnoutAt: "", spentAt: "", status: "unlit", archived: false, replacedByInstanceId: "", replacesInstanceId: "", burnHistory: [], durationHistory: [], dressings: [], burnoutNotificationEventId: "" };
      state.candle = candle;
      state.dressings = [];
    }
    return JSON.stringify(state);
  }

  function buildFreshAltarDuplicate(source, options = {}) {
    const data = clone(source || {});
    const groupMap = new Map();
    data.groups = (data.groups || []).map((group) => {
      const nextId = (options.uuid || uuid)();
      groupMap.set(group.id, nextId);
      return { ...group, id: nextId };
    });
    data.activeGroupId = groupMap.get(data.activeGroupId) || null;
    data.objects = (data.objects || []).map((object) => ({
      ...object,
      altarObjectId: (options.uuid || uuid)(),
      instanceId: (options.uuid || uuid)(),
      groupId: groupMap.get(object.groupId) || "",
      lit: "false",
      ritualIncluded: "false",
      livingState: freshLivingState(object.livingState, object)
    }));
    data.savedAt = new Date().toISOString();
    return data;
  }

  function isFavorite(altar) {
    return altar?.favorite === true || altar?.metadata?.favorite === true;
  }

  function safeTime(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }

  function organizeSavedAltars(altars, options = {}) {
    const filter = options.filter === "favorites" ? "favorites" : "all";
    const sort = ["newest", "oldest", "updated", "name"].includes(options.sort) ? options.sort : "default";
    const rows = (Array.isArray(altars) ? altars : []).map((altar, index) => ({ altar, index }));
    const filtered = filter === "favorites" ? rows.filter(({ altar }) => isFavorite(altar)) : rows;
    const compare = (left, right) => {
      if (sort === "default") {
        const favoriteDifference = Number(isFavorite(right.altar)) - Number(isFavorite(left.altar));
        return favoriteDifference || left.index - right.index;
      }
      if (sort === "name") return String(left.altar.name || "").localeCompare(String(right.altar.name || ""), undefined, { sensitivity: "base" }) || left.index - right.index;
      const leftTime = sort === "updated" ? safeTime(left.altar.updatedAt || left.altar.savedAt) : safeTime(left.altar.savedAt);
      const rightTime = sort === "updated" ? safeTime(right.altar.updatedAt || right.altar.savedAt) : safeTime(right.altar.savedAt);
      return (sort === "oldest" ? leftTime - rightTime : rightTime - leftTime) || left.index - right.index;
    };
    return filtered.sort(compare).map(({ altar }) => altar);
  }

  global.AltarSaveModes = Object.freeze({ buildFreshAltarDuplicate, freshLivingState, isFavorite, organizeSavedAltars });
  if (typeof module !== "undefined") module.exports = global.AltarSaveModes;
})(typeof window !== "undefined" ? window : globalThis);
