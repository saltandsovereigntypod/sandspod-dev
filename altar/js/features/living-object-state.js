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
      lifecycle: {
        status: "active"
      },
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
      lifecycle: {
        ...base.lifecycle,
        ...(incoming?.lifecycle || {})
      },
      candle: {
        ...base.candle,
        ...(incoming?.candle || {})
      },
      crystal: {
        ...base.crystal,
        ...(incoming?.crystal || {})
      },
      deity: {
        ...base.deity,
        ...(incoming?.deity || {})
      },
      apothecary: {
        ...base.apothecary,
        ...(incoming?.apothecary || {})
      }
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
    if (Array.isArray(existingDressings) && existingDressings.length) {
      state.candle.dressings = existingDressings;
    }

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
      if (typeof scheduleCompanionCurrentState === "function") {
        scheduleCompanionCurrentState(object);
      }
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
    if (!object || object.dataset.type !== "candle") return;

    updateLivingState(object, (state) => {
      const time = nowIso();
      state.lastUsedAt = time;
      state.candle.lastLitAt = time;
      state.candle.currentBurnStartedAt = time;
      return state;
    });
  }

  function stopCandleBurn(object) {
    if (!object || object.dataset.type !== "candle") return;

    updateLivingState(object, (state) => {
      const startedAt = new Date(state.candle.currentBurnStartedAt || "").getTime();
      if (Number.isFinite(startedAt)) {
        state.candle.totalBurnMs = Math.max(0, Number(state.candle.totalBurnMs) || 0)
          + Math.max(0, Date.now() - startedAt);
      }

      state.lastUsedAt = nowIso();
      state.candle.currentBurnStartedAt = "";
      return state;
    });
  }

  function syncCandleDressings(object) {
    if (!object || object.dataset.type !== "candle") return;

    updateLivingState(object, (state) => {
      state.candle.dressings = safeParse(object.dataset.dressings || "[]", []);
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setObjectRitual(object, ritual = null) {
    updateLivingState(object, (state) => {
      state.currentRitualId = ritual?.id || "";
      state.currentRitualName = ritual?.name || ritual?.title || "";
      state.lastUsedAt = ritual ? nowIso() : state.lastUsedAt;
      return state;
    });
  }

  function setCrystalCare(object, care = {}) {
    updateLivingState(object, (state) => {
      if (care.cleansedAt) state.crystal.lastCleansedAt = care.cleansedAt;
      if (care.chargedAt) state.crystal.lastChargedAt = care.chargedAt;
      if (care.dedication !== undefined) state.crystal.dedication = care.dedication;
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setDeityState(object, deityState = {}) {
    updateLivingState(object, (state) => {
      if (deityState.lastOfferingAt) state.deity.lastOfferingAt = deityState.lastOfferingAt;
      if (deityState.offeringStatus !== undefined) {
        state.deity.offeringStatus = deityState.offeringStatus;
      }
      if (deityState.reasonForPresence !== undefined) {
        state.deity.reasonForPresence = deityState.reasonForPresence;
      }
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function setApothecaryState(object, apothecaryState = {}) {
    updateLivingState(object, (state) => {
      state.apothecary = {
        ...state.apothecary,
        ...apothecaryState
      };
      state.lastUsedAt = nowIso();
      return state;
    });
  }

  function wrapExistingFunctions() {
    if (typeof window.toggleLight === "function" && !window.toggleLight.__livingStateWrapped) {
      const originalToggleLight = window.toggleLight;
      const wrappedToggleLight = function wrappedToggleLight(object) {
        const wasLit = object?.dataset.lit === "true";
        const result = originalToggleLight.apply(this, arguments);
        const isLit = object?.dataset.lit === "true";

        if (!wasLit && isLit) startCandleBurn(object);
        if (wasLit && !isLit) stopCandleBurn(object);
        return result;
      };
      wrappedToggleLight.__livingStateWrapped = true;
      window.toggleLight = wrappedToggleLight;
    }

    if (typeof window.dressCandle === "function" && !window.dressCandle.__livingStateWrapped) {
      const originalDressCandle = window.dressCandle;
      const wrappedDressCandle = function wrappedDressCandle(candle) {
        const result = originalDressCandle.apply(this, arguments);
        syncCandleDressings(candle);
        return result;
      };
      wrappedDressCandle.__livingStateWrapped = true;
      window.dressCandle = wrappedDressCandle;
    }

    if (typeof window.createAltarSnapshot === "function" && !window.createAltarSnapshot.__livingStateWrapped) {
      const originalCreateSnapshot = window.createAltarSnapshot;
      const wrappedCreateSnapshot = function wrappedCreateSnapshot() {
        document.querySelectorAll(".altar-object").forEach((object) => initializeObject(object));
        const snapshot = originalCreateSnapshot.apply(this, arguments);
        if (!snapshot?.objects) return snapshot;

        snapshot.objects.forEach((savedObject, index) => {
          const object = document.querySelectorAll(".altar-object")[index];
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
  window.setLivingObjectRitual = setObjectRitual;
  window.setLivingCrystalCare = setCrystalCare;
  window.setLivingDeityState = setDeityState;
  window.setLivingApothecaryState = setApothecaryState;

  wrapExistingFunctions();
  initializeExistingObjects();
  window.setTimeout(() => {
    wrapExistingFunctions();
    initializeExistingObjects();
  }, 0);
})();