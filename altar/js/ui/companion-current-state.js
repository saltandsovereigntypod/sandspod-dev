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

  function firstValue(...values) {
    return values.find((value) => value !== "" && value !== null && value !== undefined) ?? "";
  }

  function getIdentity(panel, object) {
    const preset = panel?.dataset.companionIdentity;
    if (preset && preset !== "empty") return preset;

    const raw = String(object?.dataset.apothecaryType || object?.dataset.type || "entry").toLowerCase();
    if (raw.includes("spell jar") || raw.includes("spell-jar")) return "spell-jar";
    if (raw.includes("herb mix") || raw.includes("herb-mix")) return "herb-blend";
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

  function formatCandleDressingIdentity(dressing = {}) {
    const identity = String(dressing.herb || dressing.name || "").trim();
    if (identity) return humanize(identity);

    const knownForms = [
      "loose", "powder", "powdered", "oil", "whole", "dried", "fresh",
      "leaf", "leaves", "root", "bark", "flower", "flowers", "petal",
      "petals", "resin", "seed", "seeds", "crushed"
    ];
    const form = String(dressing.form || dressing.type || "").trim().toLowerCase();
    const suffixes = [...new Set([form, ...knownForms].filter(Boolean))]
      .sort((a, b) => b.length - a.length);
    let label = String(dressing.label || "").trim();

    suffixes.some((suffix) => {
      const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?:\\s+|\\s*[·—–-]\\s*)${escaped}$`, "i");
      if (!pattern.test(label)) return false;
      label = label.replace(pattern, "").trim();
      return true;
    });

    return humanize(label || dressing.type || "");
  }

  function getDressingRows(object) {
    const state = typeof getLivingObjectState === "function" ? getLivingObjectState(object) : null;
    const dressings = Array.isArray(state?.candle?.dressings) ? state.candle.dressings : [];
    const seen = new Set();
    const labels = dressings.reduce((names, dressing) => {
      const name = formatCandleDressingIdentity(dressing);
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) return names;
      seen.add(key);
      names.push(name);
      return names;
    }, []);

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

  function getRows(identity, object) {
    const rows = [];
    const livingState = typeof getLivingObjectState === "function" ? getLivingObjectState(object) : null;
    const apothecary = getApothecary(object) || {};
    const hasLifecycle = Boolean(
      document.querySelector(".altar-companion-panel [data-companion-lifecycle]")
    );
    const ritualName = livingState?.currentRitualName || "";

    const add = (label, value, formatter = null) => {
      if (value === "" || value === null || value === undefined) return;
      const formatted = formatter ? formatter(value) : value;
      if (formatted === "" || formatted === null || formatted === undefined) return;
      rows.push({ label, value: formatted });
    };

    if (identity === "candle") {
      getDressingRows(object).forEach((row) => rows.push(row));
      add("Current Ritual", ritualName);
      add("Group", getGroupName(object));
    } else if (identity === "herb") {
      add("Current Ritual", ritualName);
      add("Group", getGroupName(object));
    } else if (identity === "crystal") {
      const currentIntention = firstValue(
        livingState?.crystal?.intention?.text,
        livingState?.crystal?.currentIntention,
        livingState?.crystal?.dedicationDetails?.intention,
        livingState?.crystal?.dedicationDetails?.purpose,
        livingState?.crystal?.dedication
      );
      add("Current Intention", currentIntention || "No recorded intention");
      add("Last Cleansed", livingState?.crystal?.lastCleansedAt, formatDate);
      add("Last Charged", livingState?.crystal?.lastChargedAt, formatDate);
      if (livingState?.crystal?.dedication && livingState.crystal.dedication !== currentIntention) {
        add("Dedication", livingState.crystal.dedication);
      }
      add("Current Ritual", ritualName);
      add("Group", getGroupName(object));
    } else if (identity === "deity") {
      add("Reason for Presence", livingState?.deity?.reasonForPresence);
      add("Offering Status", livingState?.deity?.offeringStatus, humanize);
      add("Last Offering", livingState?.deity?.lastOfferingAt, formatDate);
      add("Current Ritual", ritualName);
      add("Group", getGroupName(object));
    } else if (CRAFTED_IDENTITIES.has(identity)) {
      const craftedState = livingState?.apothecary || {};
      if (!hasLifecycle) {
        add("Status", craftedState.status, humanize);
        add("Created", firstValue(livingState?.createdAt, apothecary.createdAt), formatDate);
        add("Remaining", firstValue(craftedState.remainingAmount, apothecary.remainingAmount));
        add("Next Tending", firstValue(craftedState.nextTendingAt, apothecary.nextTendingAt), formatDate);
        add("Review / Expiration", craftedState.reviewAt, formatDate);
      }
      add("Activation", firstValue(craftedState.activationState, apothecary.activationState), humanize);
      add("Current Ritual", ritualName);
      add("Group", getGroupName(object));
    } else {
      add("Current Ritual", ritualName);
      add("Group", getGroupName(object));
    }

    return rows;
  }

  function renderRow(row) {
    const key = String(row.label || "state").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `<div class="companion-v4-state-row" data-companion-expanded-state-row data-companion-state-key="${key}"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.value)}</span></div>`;
  }

  function getSelectedObject(object = null) {
    if (object === false) return null;
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

  document.addEventListener("companion:refreshed", (event) => {
    scheduleCurrentState(event.detail?.entityOnly ? false : event.detail?.object || null);
  });
  scheduleCurrentState();
})();
