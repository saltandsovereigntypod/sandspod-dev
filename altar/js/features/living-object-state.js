/* =========================================================
   LIVING OBJECT STATE
   Persistent, shared state for altar objects.
   Keeps live object history separate from visual identity.
   ========================================================= */

(function initializeLivingObjectState() {
  const STATE_VERSION = 1;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(value, fallback) {
    if (value && typeof value === "object") return value;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function ensureObjectId(object) {
    if (!object) return "";
    if (!object.dataset.altarObjectId) {
      object.dataset.altarObjectId = crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());
    }
    return object.dataset.altarObjectId;
  }

  function defaultState(object) {
    const createdAt = object?.dataset.createdAt || nowIso();
    return {
      version: STATE_VERSION,
      createdAt,
      updatedAt: createdAt,
      lastUsedAt: "",
      currentRitualId: "",
      currentRitualName: "",
      notes: "",
      lifecycle: { status: "active" },
      candle: {
        totalBurnMs: 0,
        currentBurnStartedAt: "",
        lastLitAt: "",
        burnHistory: [],
        dressings: []
      },
      crystal: {
        lastChargedAt: "",
        lastCleansedAt: "",
        dedication: "",
        dedicationDetails: null,
        cleansingHistory: [],
        chargingHistory: []
      },
      deity: {
        lastOfferingAt: "",
        offeringStatus: "",
        reasonForPresence: "",
        reasonDetails: null,
        offerings: [],
        offeringStatusHistory: []
      },
      apothecary: {
        activationState: "",
        remainingAmount: "",
        reviewAt: "",
        status: "active",
        nextTendingAt: ""
      }
    };
  }

  function mergeState(base, incoming) {
    return {
      ...base,
      ...(incoming || {}),
      lifecycle: { ...base.lifecycle, ...(incoming?.lifecycle || {}) },
      candle: { ...base.candle, ...(incoming?.candle || {}) },
      crystal: { ...base.crystal, ...(incoming?.crystal || {}) },
      deity: { ...base.deity, ...(incoming?.deity || {}) },
      apothecary: { ...base.apothecary, ...(incoming?.apothecary || {}) }
    };
  }

  function getLivingState(object) {
    if (!object) return null;
    ensureObjectId(object);

    const state = mergeState(
      defaultState(object),
      safeParse(object.dataset.livingState || "", {})
    );

    // Import legacy candle fields once when loading an altar saved before
    // Living Object State. Once livingState exists it is the sole authority.
    if (!object.dataset.livingState) {
      const existingDressings = safeParse(object.dataset.dressings || "[]", []);
      if (Array.isArray(existingDressings)) state.candle.dressings = existingDressings;
      state.candle.totalBurnMs = Math.max(0, Number(object.dataset.accumulatedBurnMs) || 0);
      state.candle.currentBurnStartedAt = object.dataset.currentBurnStartedAt || "";
      state.candle.lastLitAt = object.dataset.lastLitAt || "";
    }
    if (!Array.isArray(state.candle.burnHistory)) state.candle.burnHistory = [];
    if (!Array.isArray(state.candle.dressings)) state.candle.dressings = [];
    if (!Array.isArray(state.crystal.cleansingHistory)) state.crystal.cleansingHistory = [];
    if (!Array.isArray(state.crystal.chargingHistory)) state.crystal.chargingHistory = [];
    if (!Array.isArray(state.deity.offerings)) state.deity.offerings = [];
    if (!Array.isArray(state.deity.offeringStatusHistory)) state.deity.offeringStatusHistory = [];
    return state;
  }

  function mirrorStateToDataset(object, state) {
    if (!object || !state) return;

    object.dataset.createdAt = state.createdAt || "";
    object.dataset.lastUsedAt = state.lastUsedAt || "";
    object.dataset.currentRitualId = state.currentRitualId || "";
    object.dataset.currentRitualName = state.currentRitualName || "";
    object.dataset.status = state.lifecycle?.status || "active";

    object.dataset.lastChargedAt = state.crystal?.lastChargedAt || "";
    object.dataset.lastCleansedAt = state.crystal?.lastCleansedAt || "";
    object.dataset.dedication = state.crystal?.dedication || "";

    object.dataset.lastOfferingAt = state.deity?.lastOfferingAt || "";
    object.dataset.offeringStatus = state.deity?.offeringStatus || "";
    object.dataset.reasonForPresence = state.deity?.reasonForPresence || "";

    object.dataset.activationState = state.apothecary?.activationState || "";
    object.dataset.remainingAmount = state.apothecary?.remainingAmount || "";
    object.dataset.reviewAt = state.apothecary?.reviewAt || "";
    object.dataset.nextTendingAt = state.apothecary?.nextTendingAt || "";
  }

  function saveLivingState(object, state, options = {}) {
    if (!object || !state) return null;

    const nextState = mergeState(defaultState(object), state);
    nextState.version = STATE_VERSION;
    nextState.updatedAt = options.preserveUpdatedAt
      ? nextState.updatedAt || nowIso()
      : nowIso();

    object.dataset.livingState = JSON.stringify(nextState);
    delete object.dataset.accumulatedBurnMs;
    delete object.dataset.currentBurnStartedAt;
    delete object.dataset.lastLitAt;
    delete object.dataset.dressings;
    mirrorStateToDataset(object, nextState);

    if (!options.silent) {
      if (typeof saveWorkingAltarDraft === "function") saveWorkingAltarDraft();
      if (typeof scheduleCompanionV4 === "function") scheduleCompanionV4(object);
      if (typeof scheduleCompanionCurrentState === "function") scheduleCompanionCurrentState(object);
      document.dispatchEvent(new CustomEvent("living-object-state:changed", {
        detail: { object, state: nextState }
      }));
    }

    return nextState;
  }

  function updateLivingState(object, updater, options = {}) {
    const current = getLivingState(object);
    if (!current) return null;
    const draft = mergeState(defaultState(object), current);
    const result = typeof updater === "function" ? updater(draft) : updater;
    return saveLivingState(object, result || draft, options);
  }

  function initializeObject(object, options = {}) {
    if (!object?.classList?.contains("altar-object")) return null;

    const state = getLivingState(object);
    let repaired = false;
    if (object.dataset.type === "candle" && object.dataset.lit === "true" && !state.candle.currentBurnStartedAt) {
      const time = nowIso();
      state.candle.currentBurnStartedAt = time;
      state.candle.lastLitAt = state.candle.lastLitAt || time;
      repaired = true;
    }

    if (!object.dataset.livingState || repaired) {
      return saveLivingState(object, state, {
        silent: true,
        preserveUpdatedAt: true,
        ...options
      });
    }

    mirrorStateToDataset(object, state);
    return state;
  }

  function startCandleBurn(object) {
    if (!object || object.dataset.type !== "candle") return null;
    const current = getLivingState(object);
    if (current?.candle?.currentBurnStartedAt) return current;

    return updateLivingState(object, (state) => {
      const time = nowIso();
      state.lastUsedAt = time;
      state.candle.lastLitAt = time;
      state.candle.currentBurnStartedAt = time;
      return state;
    });
  }

  function stopCandleBurn(object) {
    if (!object || object.dataset.type !== "candle") return null;
    const current = getLivingState(object);
    if (!Number.isFinite(Date.parse(current?.candle?.currentBurnStartedAt || ""))) return current;

    return updateLivingState(object, (state) => {
      const startedAt = Date.parse(state.candle.currentBurnStartedAt || "");
      if (Number.isFinite(startedAt)) {
        const endedAt = nowIso();
        const durationMs = Math.max(0, Date.parse(endedAt) - startedAt);
        state.candle.totalBurnMs = Math.max(0, Number(state.candle.totalBurnMs) || 0) + durationMs;
        state.candle.burnHistory.push({
          startedAt: state.candle.currentBurnStartedAt,
          endedAt,
          durationMs
        });
      }
      state.lastUsedAt = nowIso();
      state.candle.currentBurnStartedAt = "";
      return state;
    });
  }

  function syncCandleDressings(object, dressings = null) {
    if (!object || object.dataset.type !== "candle") return null;
    const nextDressings = Array.isArray(dressings) ? dressings : [];
    const current = getLivingState(object);
    if (JSON.stringify(current?.candle?.dressings || []) === JSON.stringify(nextDressings)) return current;

    return updateLivingState(object, (state) => {
      state.candle.dressings = nextDressings;
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setObjectRitual(object, ritual = null) {
    return updateLivingState(object, (state) => {
      state.currentRitualId = ritual?.id || "";
      state.currentRitualName = ritual?.name || ritual?.title || "";
      state.lastUsedAt = ritual ? nowIso() : state.lastUsedAt;
      return state;
    });
  }

  function setCrystalCare(object, care = {}) {
    return updateLivingState(object, (state) => {
      if (care.cleansedAt) state.crystal.lastCleansedAt = care.cleansedAt;
      if (care.chargedAt) state.crystal.lastChargedAt = care.chargedAt;
      if (care.dedication !== undefined) state.crystal.dedication = care.dedication;
      if (care.dedicationDetails !== undefined) state.crystal.dedicationDetails = care.dedicationDetails;
      if (care.cleansingRecord) state.crystal.cleansingHistory.push(care.cleansingRecord);
      if (care.chargingRecord) state.crystal.chargingHistory.push(care.chargingRecord);
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setDeityState(object, deityState = {}) {
    return updateLivingState(object, (state) => {
      if (deityState.lastOfferingAt) state.deity.lastOfferingAt = deityState.lastOfferingAt;
      if (deityState.offeringStatus !== undefined) state.deity.offeringStatus = deityState.offeringStatus;
      if (deityState.reasonForPresence !== undefined) state.deity.reasonForPresence = deityState.reasonForPresence;
      if (deityState.reasonDetails !== undefined) state.deity.reasonDetails = deityState.reasonDetails;
      if (deityState.offeringRecord) state.deity.offerings.push(deityState.offeringRecord);
      if (deityState.offeringStatusRecord) state.deity.offeringStatusHistory.push(deityState.offeringStatusRecord);
      if (deityState.updateLatestOffering && state.deity.offerings.length) {
        state.deity.offerings[state.deity.offerings.length - 1] = {
          ...state.deity.offerings[state.deity.offerings.length - 1],
          ...deityState.updateLatestOffering
        };
      }
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setApothecaryState(object, apothecaryState = {}) {
    return updateLivingState(object, (state) => {
      state.apothecary = { ...state.apothecary, ...apothecaryState };
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function initializeExistingObjects() {
    document.querySelectorAll(".altar-object").forEach((object) => initializeObject(object));
  }

  const stage = document.querySelector("[data-altar-stage]");
  if (stage) {
    const stageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains("altar-object")) initializeObject(node);
          node.querySelectorAll?.(".altar-object").forEach((object) => initializeObject(object));
        });
      });
    });
    stageObserver.observe(stage, { childList: true, subtree: true });
  }

  window.getLivingObjectState = getLivingState;
  window.saveLivingObjectState = saveLivingState;
  window.updateLivingObjectState = updateLivingState;
  window.initializeLivingObjectState = initializeObject;
  window.startLivingCandleBurn = startCandleBurn;
  window.stopLivingCandleBurn = stopCandleBurn;
  window.syncLivingCandleDressings = syncCandleDressings;
  window.setLivingObjectRitual = setObjectRitual;
  window.setLivingCrystalCare = setCrystalCare;
  window.setLivingDeityState = setDeityState;
  window.setLivingApothecaryState = setApothecaryState;

  initializeExistingObjects();
})();
