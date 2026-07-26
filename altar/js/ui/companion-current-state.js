/* =========================================================
   COMPANION CURRENT STATE
   Authoritative identity-aware renderer for the V4 Current State card.
   ========================================================= */

(function initializeCompanionCurrentState() {
  const CRAFTED_IDENTITIES = new Set([
    "spell-jar", "oil", "incense", "sachet", "spray",
    "poppet", "powder", "tea", "herb-blend"
  ]);

  let observedBody = null;
  let observer = null;
  let isRendering = false;

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

  function parseDressings(object) {
    try {
      const parsed = JSON.parse(object?.dataset.dressings || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getDressingRows(object) {
    const dressings = parseDressings(object);
    const herbs = [];
    const oils = [];

    dressings.forEach((dressing) => {
      const label = dressing.label || dressing.herb || dressing.name || "";
      if (!label) return;
      if (dressing.type === "oil") oils.push(humanize(label));
      else if (dressing.type === "herb") herbs.push(humanize(dressing.herb || label));
    });

    const rows = [];
    if (herbs.length) rows.push({ label: "Herbs", value: [...new Set(herbs)].join(", ") });
    if (oils.length) rows.push({ label: "Oil", value: [...new Set(oils)].join(", ") });
    return rows;
  }

  function getGroupName(object) {
    const groupId = object?.dataset.groupId;
    if (!groupId) return "";
    if (typeof getGroupById === "function") return getGroupById(groupId)?.name || "";
    return object.dataset.groupName || "";
  }

  function getBurnTime(object) {
    const saved = Number(object?.dataset.accumulatedBurnMs || 0);
    if (object?.dataset.lit !== "true") return saved;
    const started = new Date(object.dataset.currentBurnStartedAt || "").getTime();
    return saved + (Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0);
  }

  function getRows(identity, object) {
    const rows = [];
    const data = object?.dataset || {};
    const apothecary = getApothecary(object) || {};

    const add = (label, value, formatter = null) => {
      if (value === "" || value === null || value === undefined) return;
      const formatted = formatter ? formatter(value) : value;
      if (formatted === "" || formatted === null || formatted === undefined) return;
      rows.push({ label, value: formatted });
    };

    if (identity === "candle") {
      add("Type", firstValue(data.candleType, data.form, data.candleStyle), humanize);
      getDressingRows(object).forEach((row) => rows.push(row));
      add("Burning Time", getBurnTime(object), formatDuration);
      add("Last Lit", firstValue(data.lastLitAt, data.lastLit), formatDateTime);
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    } else if (identity === "herb") {
      add("Form", firstValue(data.form, apothecary.form), humanize);
      add("Currently Part Of", firstValue(data.currentRitualName, data.ritualName));
      add("Group", getGroupName(object));
    } else if (identity === "crystal") {
      add("Form", firstValue(data.form, data.crystalForm, apothecary.form), humanize);
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
      add("Status", firstValue(data.status, apothecary.status, "Active"), humanize);
      add("Created", firstValue(data.createdAt, data.creationDate, apothecary.createdAt), formatDate);
      add("Remaining", firstValue(data.remainingAmount, data.amountRemaining, apothecary.remainingAmount));
      add("Next Tending", firstValue(data.nextTendingAt, data.nextTending, apothecary.nextTendingAt), formatDate);
      add("Review / Expiration", firstValue(data.expiresAt, data.expirationDate, data.reviewAt, data.reviewDate), formatDate);
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
      observeCurrentStateBody();
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
      observeCurrentStateBody();
      return true;
    } finally {
      isRendering = false;
    }
  }

  function observeCurrentStateBody() {
    const nextBody = document.querySelector("[data-companion-v4-current-state-body]");
    if (!nextBody || nextBody === observedBody) return;
    observer?.disconnect();
    observedBody = nextBody;
    observer = new MutationObserver(() => {
      if (isRendering) return;
      queueMicrotask(() => renderCurrentState());
    });
    observer.observe(nextBody, { childList: true, subtree: false });
  }

  function scheduleCurrentState(object = null) {
    queueMicrotask(() => renderCurrentState(object));
    requestAnimationFrame(() => renderCurrentState(object));
    window.setTimeout(() => renderCurrentState(object), 160);
    window.setTimeout(() => renderCurrentState(object), 560);
  }

  window.getCompanionCurrentStateRows = getRows;
  window.renderCompanionCurrentState = renderCurrentState;
  window.scheduleCompanionCurrentState = scheduleCurrentState;

  document.addEventListener("companion:refreshed", (event) => scheduleCurrentState(event.detail?.object || null));
  window.addEventListener("saltSettingsChanged", () => scheduleCurrentState());
  window.setInterval(() => {
    const target = getSelectedObject();
    if (target?.dataset.type === "candle" && target.dataset.lit === "true") renderCurrentState(target);
  }, 60000);
  scheduleCurrentState();
})();