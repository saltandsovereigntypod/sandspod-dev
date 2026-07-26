/* =========================================================
   COMPANION CURRENT STATE
   Adds identity-aware live details to the V4 Current State card
   without changing Living Library data or Sanctuary settings.
   ========================================================= */

(function initializeCompanionCurrentState() {
  const CRAFTED_IDENTITIES = new Set([
    "spell-jar",
    "oil",
    "incense",
    "sachet",
    "spray",
    "poppet",
    "powder",
    "tea",
    "herb-blend"
  ]);

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

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
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

  function getRows(identity, object) {
    const rows = [];
    const data = object?.dataset || {};
    const apothecary = getApothecary(object);

    const add = (label, value, formatter = null) => {
      if (value === "" || value === null || value === undefined) return;
      const formatted = formatter ? formatter(value) : value;
      if (formatted === "" || formatted === null || formatted === undefined) return;
      rows.push({ label, value: formatted });
    };

    if (identity === "candle") {
      add("Color", firstValue(data.color, apothecary?.color), humanize);
      add("Dressed", data.dressed === "true" ? "Yes" : data.dressed === "false" ? "No" : "");
      add("Last Lit", firstValue(data.lastLitAt, data.lastLit, apothecary?.lastLitAt), formatDate);
    } else if (identity === "herb") {
      add("Form", firstValue(data.form, apothecary?.form), humanize);
    } else if (identity === "crystal") {
      add("Form", firstValue(data.form, data.crystalForm, apothecary?.form), humanize);
      add("Last Cleansed", firstValue(data.lastCleansedAt, data.lastCleansed, apothecary?.lastCleansedAt), formatDate);
      add("Last Charged", firstValue(data.lastChargedAt, data.lastCharged, apothecary?.lastChargedAt), formatDate);
    } else if (identity === "deity") {
      add("Reason for Presence", firstValue(
        data.reasonForPresence,
        data.altarPurpose,
        data.devotionalPurpose,
        apothecary?.reasonForPresence
      ));
      add("Offering", firstValue(data.offeringStatus, data.currentOffering, apothecary?.offeringStatus), humanize);
      add("Last Offering", firstValue(data.lastOfferingAt, data.lastOffering, apothecary?.lastOfferingAt), formatDate);
    } else if (CRAFTED_IDENTITIES.has(identity)) {
      add("Status", firstValue(data.status, apothecary?.status, "Active"), humanize);
      add("Activation", firstValue(data.activationState, apothecary?.activationState), humanize);
    }

    return rows;
  }

  function renderRow(row) {
    return `
      <div class="companion-v4-state-row" data-companion-expanded-state-row>
        <strong>${escapeHtml(row.label)}</strong>
        <span>${escapeHtml(row.value)}</span>
      </div>
    `;
  }

  function expandCurrentState(object = null) {
    const panel = document.querySelector(".altar-companion-panel");
    const body = panel?.querySelector("[data-companion-v4-current-state-body]");
    if (!panel || !body) return false;

    const target = object || (typeof selectedObject !== "undefined" ? selectedObject : null);
    const identity = getIdentity(panel, target);
    const rows = getRows(identity, target);
    const lifecycle = body.querySelector("[data-companion-lifecycle]");

    body.querySelectorAll(".companion-v4-state-row").forEach((row) => row.remove());

    if (rows.length) {
      body.insertAdjacentHTML("afterbegin", rows.map(renderRow).join(""));
    }

    if (!rows.length && !lifecycle) {
      panel.querySelector("[data-companion-v4-current-state]")?.remove();
    }

    return true;
  }

  function scheduleCurrentStateExpansion(object = null) {
    queueMicrotask(() => expandCurrentState(object));
    requestAnimationFrame(() => expandCurrentState(object));
    window.setTimeout(() => expandCurrentState(object), 140);
    window.setTimeout(() => expandCurrentState(object), 520);
  }

  window.expandCompanionCurrentState = expandCurrentState;
  window.scheduleCompanionCurrentStateExpansion = scheduleCurrentStateExpansion;

  document.addEventListener("companion:refreshed", (event) => {
    scheduleCurrentStateExpansion(event.detail?.object || null);
  });

  window.addEventListener("saltSettingsChanged", () => scheduleCurrentStateExpansion());
  scheduleCurrentStateExpansion();
})();
