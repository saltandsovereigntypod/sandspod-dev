/* =========================================================
   COMPANION CURRENT STATE
   Authoritative identity-aware renderer for the V4 Current State card.
   ========================================================= */

(function initializeCompanionCurrentState() {
  const CRAFTED_IDENTITIES = new Set([
    "spell-jar", "oil", "incense", "sachet", "spray",
    "poppet", "powder", "tea", "herb-blend"
  ]);

  let isRendering = false;
  let renderFrame = null;
  let pendingObject = null;

  function escapeHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function humanize(value = "") {
    return String(value || "")
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  function formatDuration(milliseconds) {
    const totalMinutes = Math.floor(Math.max(0, Number(milliseconds) || 0) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours && !minutes) return "Less than 1 minute";
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }

  function firstValue(...values) {
    return values.find((value) => value !== "" && value !== null && value !== undefined) ?? "";
  }

  function getIdentity(panel, object) {
    const preset = panel?.dataset.companionIdentity;
    if (preset && preset !== "empty") return preset;

    const raw = String(object?.dataset.apothecaryType || object?.dataset.type || "entry").toLowerCase();
    if (raw.includes("spell jar") || raw.includes("spell-jar")) return "spell-jar";
    if (raw.includes("herb blend") || raw.includes("herb-blend")) return "herb-blend";
    if (raw.includes("candle")) return "candle";
    if (raw.includes("crystal")) return "crystal";
    if (raw.includes("herb")) return "herb";
    if (raw.includes("powder")) return "powder";
    if (raw.includes("tea")) return "tea";
    if (raw.includes("oil")) return "oil";
    if (raw.includes("incense")) return "incense";
    if (raw.includes("sachet")) return "sachet";
    if (raw.includes("spray")) return "spray";
    if (raw.includes("poppet")) return "poppet";
    if (raw.includes("deity")) return "deity";
    return raw.replace(/[^a-z0-9]+/g, "-") || "entry";
  }

  function getApothecary(object) {
    return object && typeof getApothecaryDetailsForObject === "function"
      ? getApothecaryDetailsForObject(object)
      : null;
  }

  function getDressingRows(object) {
    const state = typeof getLivingObjectState === "function" ? getLivingObjectState(object) : null;
    const dressings = Array.isArray(state?.candle?.dressings) ? state.candle.dressings : [];
    const labels = dressings
      .map((dressing) => {
        if (typeof formatDressingName === "function") return formatDressingName(dressing);
        return humanize(dressing.label || dressing.herb || dressing.name || dressing.type || "");
      })
      .filter(Boolean);

    return labels.length
      ? [{ label: "Dressed With", value: [...new Set(labels)].join(", ") }]
      : [];
  }

  function getGroupName(object) {
    const groupId = object?.dataset.groupId;
    if (!groupId) return "";
    if (typeof getGroupById === "function") return getGroupById(groupId)?.name || "";
    return object.dataset.groupName || "";
  }

  function getBurnTime(object) {
    const state = typeof getLivingObjectState === "function" ? getLivingObjectState(object) : null;
    const saved = Number(state?.candle?.totalBurnMs || 0);
    if (object?.dataset.lit !== "true") return saved;
    const started = new Date(state?.candle?.currentBurnStartedAt || "").getTime();
    return saved + (Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0);
  }

  function getRows(identity, object) {
    const rows = [];
    const data = object?.dataset || {};
    const livingState = typeof getLivingObjectState === "function" ? getLivingObjectState(object) : null;
    const apothecary = getApothecary(object) || {};
    const hasLifecycle = Boolean(
      document.querySelector(".altar-companion-panel [data-companion-lifecycle]")
    );

    const add = (label, value, formatter = null) => {
      if (value === "" || value === null || value === undefined) return;
      const formatted = formatter ? formatter(value) : value;
      if (formatted === "" || formatted === null || formatted === undefined) return;
      rows.push({ label, value: formatted });
    };

    if (identity === "candle") {
      getDressingRows(object).forEach((row) => rows.push(row));
      add("Burning Time", getBurnTime(object), formatDuration);
      add("Last Burned", livingState?.candle?.lastLitAt, formatDateTime);
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    } else if (identity === "herb") {
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    } else if (identity === "crystal") {
      add("Last Cleansed", firstValue(data.lastCleansedAt, data.lastCleansed, apothecary.lastCleansedAt), formatDate);
      add("Last Charged", firstValue(data.lastChargedAt, data.lastCharged, apothecary.lastChargedAt), formatDate);
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    } else if (identity === "deity") {
      add("Reason for Presence", firstValue(data.reasonForPresence, data.altarPurpose, data.devotionalPurpose));
      add("Offering Status", firstValue(data.offeringStatus, data.currentOffering), humanize);
      add("Last Offering", firstValue(data.lastOfferingAt, data.lastOffering), formatDate);
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    } else if (CRAFTED_IDENTITIES.has(identity)) {
      if (!hasLifecycle) {
        add("Status", firstValue(data.status, apothecary.status, "Active"), humanize);
        add("Created", firstValue(data.createdAt, data.creationDate, apothecary.createdAt), formatDate);
        add("Remaining", firstValue(data.remainingAmount, data.amountRemaining, apothecary.remainingAmount));
        add("Next Tending", firstValue(data.nextTendingAt, data.nextTending, apothecary.nextTendingAt), formatDate);
        add("Review / Expiration", firstValue(data.expiresAt, data.expirationDate, data.reviewAt, data.reviewDate), formatDate);
      }
      add("Activation", firstValue(data.activationState, apothecary.activationState), humanize);
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    }

    return rows;
  }

  function renderRow(row) {
    return `<div class="companion-v4-state-row" data-companion-expanded-state-row><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.value)}</span></div>`;
  }

  function getSelectedObject(object = null) {
    if (object) return object;
    return typeof selectedObject !== "undefined" ? selectedObject : null;
  }

  function renderCurrentState(object = null) {
    if (isRendering) return false;
    const panel = document.querySelector(".altar-companion-panel");
    const body = panel?.querySelector("[data-companion-v4-current-state-body]");
    if (!panel || !body) {
      return false;
    }

    isRendering = true;
    try {
      const target = getSelectedObject(object);
      const identity = getIdentity(panel, target);
      const rows = getRows(identity, target);
      const lifecycle = body.querySelector("[data-companion-lifecycle]");
      body.querySelectorAll(".companion-v4-state-row").forEach((row) => row.remove());
      if (rows.length) body.insertAdjacentHTML("afterbegin", rows.map(renderRow).join(""));
      const section = panel.querySelector("[data-companion-v4-current-state]");
      if (!rows.length && !lifecycle) section?.remove();
      return true;
    } finally {
      isRendering = false;
    }
  }

  function scheduleCurrentState(object = null) {
    pendingObject = object;
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      const target = pendingObject;
      pendingObject = null;
      renderCurrentState(target);
    });
  }

  window.getCompanionCurrentStateRows = getRows;
  window.renderCompanionCurrentState = renderCurrentState;
  window.scheduleCompanionCurrentState = scheduleCurrentState;

  document.addEventListener("companion:refreshed", (event) => scheduleCurrentState(event.detail?.object || null));
  window.addEventListener("saltSettingsChanged", () => scheduleCurrentState());
  window.setInterval(() => {
    const target = getSelectedObject();
    if (target?.dataset.type === "candle" && target.dataset.lit === "true") renderCurrentState(target);
  }, 1000);
  scheduleCurrentState();
})();
