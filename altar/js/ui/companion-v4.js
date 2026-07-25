/* =========================================================
   COMPANION V4
   Identity-aware Current State presentation layer.

   This module is intentionally idempotent: it may run after the immediate
   render and again after asynchronous instance/history data resolves without
   duplicating sections or event listeners.
   ========================================================= */

(function initializeCompanionV4() {
  const STYLE_ID = "companion-v4-runtime-styles";

  function escapeHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .companion-v4-current-state {
        margin: 0 0 1rem;
        border: 1px solid rgba(190, 157, 92, 0.34);
        border-radius: 1.1rem;
        background: rgba(18, 17, 14, 0.72);
        overflow: hidden;
      }

      .companion-v4-current-state > summary {
        cursor: pointer;
        list-style: none;
        padding: 1rem 1.1rem;
        color: var(--gold, #c8a96b);
        font-family: Georgia, serif;
        font-size: 1.02rem;
        font-weight: 700;
      }

      .companion-v4-current-state > summary::-webkit-details-marker {
        display: none;
      }

      .companion-v4-current-state > summary::after {
        content: "+";
        float: right;
        opacity: 0.8;
      }

      .companion-v4-current-state[open] > summary::after {
        content: "−";
      }

      .companion-v4-current-state-body {
        display: grid;
        gap: 0.7rem;
        padding: 0 1.1rem 1.1rem;
      }

      .companion-v4-state-row {
        display: grid;
        grid-template-columns: minmax(7rem, 0.42fr) minmax(0, 1fr);
        gap: 0.75rem;
        align-items: start;
        padding-top: 0.7rem;
        border-top: 1px solid rgba(190, 157, 92, 0.16);
      }

      .companion-v4-state-row strong {
        color: rgba(238, 224, 194, 0.82);
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .companion-v4-state-row span,
      .companion-v4-state-row p {
        margin: 0;
        color: rgba(245, 237, 220, 0.94);
        line-height: 1.45;
      }

      .companion-v4-current-state .companion-v3-lifecycle {
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
      }

      .companion-v4-current-state .companion-v3-lifecycle-primary {
        margin-bottom: 0.65rem;
      }
    `;
    document.head.appendChild(style);
  }

  function getPanel() {
    return document.querySelector(".altar-companion-panel");
  }

  function getContent(panel) {
    return panel?.querySelector("[data-companion-content]") || null;
  }

  function getIdentity(panel, object) {
    const preset = panel?.dataset.companionIdentity;
    if (preset && preset !== "empty") return preset;

    const raw = String(
      object?.dataset.apothecaryType ||
      object?.dataset.type ||
      "entry"
    ).toLowerCase();

    if (raw.includes("spell jar") || raw.includes("spell-jar")) return "spell-jar";
    if (raw.includes("candle")) return "candle";
    if (raw.includes("crystal")) return "crystal";
    if (raw.includes("herb")) return "herb";
    if (raw.includes("oil")) return "oil";
    if (raw.includes("incense")) return "incense";
    if (raw.includes("sachet")) return "sachet";
    if (raw.includes("spray")) return "spray";
    if (raw.includes("poppet")) return "poppet";
    if (raw.includes("deity")) return "deity";
    return raw.replace(/[^a-z0-9]+/g, "-") || "entry";
  }

  function formatIngredient(item = {}) {
    const name = item.libraryName || item.label || item.name || "Ingredient";
    const amount = String(item.amount || "").trim();
    return amount ? `${name}: ${amount}` : name;
  }

  function getApothecary(object) {
    return object && typeof getApothecaryDetailsForObject === "function"
      ? getApothecaryDetailsForObject(object)
      : null;
  }

  function getStateRows(identity, object) {
    const rows = [];
    const apothecary = getApothecary(object);

    const add = (label, value) => {
      if (value === "" || value === null || value === undefined) return;
      if (Array.isArray(value) && !value.length) return;
      rows.push({ label, value });
    };

    if (identity === "candle") {
      add("Flame", object?.classList.contains("is-lit") ? "Lit" : "Unlit");
      add("Color", object?.dataset.color || "");
    }

    if (identity === "spell-jar") {
      add("Intention", apothecary?.intention || "");
      add("Ingredients", Array.isArray(apothecary?.ingredients)
        ? apothecary.ingredients.map(formatIngredient)
        : []);
    }

    if (["oil", "incense", "sachet", "spray", "poppet"].includes(identity)) {
      add("Intention", apothecary?.intention || "");
      add("Ingredients", Array.isArray(apothecary?.ingredients)
        ? apothecary.ingredients.map(formatIngredient)
        : []);
    }

    if (identity === "herb") {
      add("Form", object?.dataset.form || "");
    }

    if (identity === "crystal") {
      add("Form", object?.dataset.form || object?.dataset.crystalForm || "");
    }

    if (identity === "deity") {
      add("Presence", "Placed on the altar");
    }

    return rows;
  }

  function renderRow(row) {
    const value = Array.isArray(row.value) ? row.value.join(", ") : row.value;
    return `
      <div class="companion-v4-state-row">
        <strong>${escapeHtml(row.label)}</strong>
        <span>${escapeHtml(value)}</span>
      </div>
    `;
  }

  function ensureCurrentState(panel, object) {
    const content = getContent(panel);
    const page = content?.querySelector(".companion-v3-page");
    if (!page) return;

    const identity = getIdentity(panel, object);
    const rows = getStateRows(identity, object);
    const lifecycle = panel.querySelector(".altar-companion-header [data-companion-lifecycle]");

    let section = page.querySelector("[data-companion-v4-current-state]");

    if (!rows.length && !lifecycle) {
      section?.remove();
      return;
    }

    if (!section) {
      section = document.createElement("details");
      section.className = "companion-v4-current-state";
      section.setAttribute("data-companion-v4-current-state", "");
      section.open = true;
      section.innerHTML = `
        <summary>Current State</summary>
        <div class="companion-v4-current-state-body" data-companion-v4-current-state-body></div>
      `;
      page.prepend(section);
    }

    const body = section.querySelector("[data-companion-v4-current-state-body]");
    if (!body) return;

    body.innerHTML = rows.map(renderRow).join("");

    if (lifecycle) {
      body.appendChild(lifecycle);
    }
  }

  function normalizeActions(panel) {
    const apothecaryEdit = panel.querySelector("[data-apothecary-edit]");
    if (apothecaryEdit) apothecaryEdit.textContent = "Edit Apothecary Item";

    const libraryEdit = panel.querySelector('[data-library-edit-section="myPractice"]');
    if (libraryEdit) libraryEdit.textContent = "Edit Library Entry";
  }

  function removeLegacyEmphasis(panel) {
    panel.querySelector("[data-companion-emphasis]")?.remove();
  }

  function applyCompanionV4(object = null) {
    installStyles();

    const panel = getPanel();
    if (!panel) return false;

    const target = object || (typeof selectedObject !== "undefined" ? selectedObject : null);

    removeLegacyEmphasis(panel);
    normalizeActions(panel);
    ensureCurrentState(panel, target);
    panel.dataset.companionVersion = "4";
    return true;
  }

  function scheduleCompanionV4(object = null) {
    queueMicrotask(() => applyCompanionV4(object));
    requestAnimationFrame(() => applyCompanionV4(object));
    window.setTimeout(() => applyCompanionV4(object), 120);
    window.setTimeout(() => applyCompanionV4(object), 500);
  }

  window.applyCompanionV4 = applyCompanionV4;
  window.scheduleCompanionV4 = scheduleCompanionV4;

  document.addEventListener("companion:refreshed", (event) => {
    scheduleCompanionV4(event.detail?.object || null);
  });

  window.addEventListener("saltSettingsChanged", () => scheduleCompanionV4());
  scheduleCompanionV4();
})();
