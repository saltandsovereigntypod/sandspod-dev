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
        dressings: []
      },
      crystal: {
        lastChargedAt: "",
        lastCleansedAt: "",
        dedication: ""
      },
      deity: {
        lastOfferingAt: "",
        offeringStatus: "",
        reasonForPresence: ""
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

    const existingDressings = safeParse(object.dataset.dressings || "[]", []);
    if (Array.isArray(existingDressings)) state.candle.dressings = existingDressings;
    return state;
  }

  function mirrorStateToDataset(object, state) {
    if (!object || !state) return;

    object.dataset.createdAt = state.createdAt || "";
    object.dataset.lastUsedAt = state.lastUsedAt || "";
    object.dataset.currentRitualId = state.currentRitualId || "";
    object.dataset.currentRitualName = state.currentRitualName || "";
    object.dataset.status = state.lifecycle?.status || "active";

    object.dataset.accumulatedBurnMs = String(state.candle?.totalBurnMs || 0);
    object.dataset.currentBurnStartedAt = state.candle?.currentBurnStartedAt || "";
    object.dataset.lastLitAt = state.candle?.lastLitAt || "";
    object.dataset.dressings = JSON.stringify(state.candle?.dressings || []);

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
    mirrorStateToDataset(object, nextState);

    if (!options.silent) {
      if (typeof saveWorkingAltarDraft === "function") saveWorkingAltarDraft();
      if (typeof scheduleCompanionV4 === "function") scheduleCompanionV4(object);
      if (typeof scheduleCompanionCurrentState === "function") scheduleCompanionCurrentState(object);
    }

    document.dispatchEvent(new CustomEvent("living-object-state:changed", {
      detail: { object, state: nextState }
    }));

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
    if (object.dataset.type === "candle" && object.dataset.lit === "true" && !state.candle.currentBurnStartedAt) {
      const time = nowIso();
      state.candle.currentBurnStartedAt = time;
      state.candle.lastLitAt = state.candle.lastLitAt || time;
    }

    if (!object.dataset.livingState) {
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

    return updateLivingState(object, (state) => {
      if (state.candle.currentBurnStartedAt) return state;
      const time = nowIso();
      state.lastUsedAt = time;
      state.candle.lastLitAt = time;
      state.candle.currentBurnStartedAt = time;
      return state;
    });
  }

  function stopCandleBurn(object) {
    if (!object || object.dataset.type !== "candle") return null;

    return updateLivingState(object, (state) => {
      const startedAt = Date.parse(state.candle.currentBurnStartedAt || "");
      if (Number.isFinite(startedAt)) {
        state.candle.totalBurnMs = Math.max(0, Number(state.candle.totalBurnMs) || 0)
          + Math.max(0, Date.now() - startedAt);
      }
      state.lastUsedAt = nowIso();
      state.candle.currentBurnStartedAt = "";
      return state;
    });
  }

  function syncCandleDressings(object, dressings = null) {
    if (!object || object.dataset.type !== "candle") return null;

    return updateLivingState(object, (state) => {
      state.candle.dressings = Array.isArray(dressings)
        ? dressings
        : safeParse(object.dataset.dressings || "[]", []);
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
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setDeityState(object, deityState = {}) {
    return updateLivingState(object, (state) => {
      if (deityState.lastOfferingAt) state.deity.lastOfferingAt = deityState.lastOfferingAt;
      if (deityState.offeringStatus !== undefined) state.deity.offeringStatus = deityState.offeringStatus;
      if (deityState.reasonForPresence !== undefined) state.deity.reasonForPresence = deityState.reasonForPresence;
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

  function wrapStorageFunctions() {
    if (typeof window.createAltarSnapshot === "function" && !window.createAltarSnapshot.__livingStateWrapped) {
      const originalCreateSnapshot = window.createAltarSnapshot;
      const wrappedCreateSnapshot = function wrappedCreateSnapshot() {
        const objects = Array.from(document.querySelectorAll(".altar-object"));
        objects.forEach((object) => initializeObject(object));
        const snapshot = originalCreateSnapshot.apply(this, arguments);
        if (!snapshot?.objects) return snapshot;

        snapshot.objects.forEach((savedObject, index) => {
          const object = objects[index];
          savedObject.livingState = object?.dataset.livingState || "";
          savedObject.createdAt = object?.dataset.createdAt || "";
        });
        return snapshot;
      };
      wrappedCreateSnapshot.__livingStateWrapped = true;
      window.createAltarSnapshot = wrappedCreateSnapshot;
    }

    if (typeof window.createSavedObject === "function" && !window.createSavedObject.__livingStateWrapped) {
      const originalCreateSavedObject = window.createSavedObject;
      const wrappedCreateSavedObject = function wrappedCreateSavedObject(savedObject) {
        const object = originalCreateSavedObject.apply(this, arguments);
        if (!object) return object;
        object.dataset.livingState = savedObject?.livingState || "";
        object.dataset.createdAt = savedObject?.createdAt || "";
        initializeObject(object, { preserveUpdatedAt: true });
        return object;
      };
      wrappedCreateSavedObject.__livingStateWrapped = true;
      window.createSavedObject = wrappedCreateSavedObject;
    }
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

  wrapStorageFunctions();
  initializeExistingObjects();
})();