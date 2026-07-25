/* =========================================================
   COMPANION V4
   Compact identity-aware Companion presentation layer.
   ========================================================= */

(function initializeCompanionV4() {
  const STYLE_ID = "companion-v4-runtime-styles";
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

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .altar-companion-panel[data-companion-version="4"] [data-companion-emphasis] {
        display: none !important;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-page {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-knowledge {
        display: contents;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions {
        margin: 0;
        border-radius: 0.8rem;
        overflow: hidden;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section > summary,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe > summary,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions > summary {
        min-height: 42px;
        padding: 0.62rem 0.85rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        list-style: none;
        font-size: 0.95rem;
        line-height: 1.15;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section > summary::-webkit-details-marker,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe > summary::-webkit-details-marker,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions > summary::-webkit-details-marker {
        display: none;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section > summary::after,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe > summary::after,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions > summary::after {
        content: "+";
        flex: 0 0 auto;
        opacity: 0.75;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section[open] > summary::after,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe[open] > summary::after,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions[open] > summary::after {
        content: "−";
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section-body,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe-body,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body {
        padding: 0 0.85rem 0.75rem;
      }

      .companion-v4-current-state,
      .companion-v4-recipe,
      .companion-v4-actions {
        border: 1px solid rgba(190, 157, 92, 0.34);
        background: rgba(18, 17, 14, 0.72);
      }

      .companion-v4-current-state {
        margin: 0;
        border-radius: 0.8rem;
        padding: 0.7rem 0.85rem;
        max-height: min(20vh, 10.5rem);
        overflow: hidden;
      }

      .companion-v4-current-state-title,
      .companion-v4-recipe > summary,
      .companion-v4-actions > summary {
        color: var(--gold, #c8a96b);
        font-family: Georgia, serif;
        font-weight: 700;
      }

      .companion-v4-current-state-title {
        margin: 0 0 0.45rem;
        font-size: 0.92rem;
        line-height: 1.1;
      }

      .companion-v4-current-state-body {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.35rem 0.65rem;
        max-height: calc(min(20vh, 10.5rem) - 2.2rem);
        overflow-y: auto;
        padding-right: 0.15rem;
      }

      .companion-v4-state-row {
        display: grid;
        grid-template-columns: minmax(4.7rem, auto) minmax(0, 1fr);
        gap: 0.4rem;
        align-items: start;
        padding-top: 0.35rem;
        border-top: 1px solid rgba(190, 157, 92, 0.12);
        min-width: 0;
      }

      .companion-v4-state-row strong,
      .companion-v4-recipe-label {
        color: rgba(238, 224, 194, 0.8);
        font-size: 0.66rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .companion-v4-state-row span {
        color: rgba(245, 237, 220, 0.94);
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      .companion-v4-current-state .companion-v3-lifecycle {
        grid-column: 1 / -1;
        margin: 0;
        padding: 0.4rem 0 0;
        border: 0;
        background: transparent;
      }

      .companion-v4-current-state .companion-v3-lifecycle p {
        margin: 0.2rem 0 0;
      }

      .companion-v4-recipe-body {
        display: grid;
        gap: 0.7rem;
      }

      .companion-v4-recipe-group {
        display: grid;
        gap: 0.35rem;
      }

      .companion-v4-recipe-group p {
        margin: 0;
        line-height: 1.4;
      }

      .companion-v4-ingredient-list {
        display: grid;
        gap: 0.35rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .companion-v4-ingredient-list li {
        padding: 0.5rem 0.65rem;
        border: 1px solid rgba(190, 157, 92, 0.2);
        border-radius: 0.65rem;
        background: rgba(255, 255, 255, 0.025);
      }

      .companion-v4-actions-body {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.45rem;
      }

      .companion-v4-actions-body button {
        min-height: 34px;
        width: 100%;
        margin: 0;
        padding: 0.45rem 0.6rem;
        border-radius: 0.65rem;
        font-size: 0.78rem;
        line-height: 1.15;
      }

      @media (max-width: 560px) {
        .companion-v4-current-state-body,
        .companion-v4-actions-body {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getPanel() {
    return document.querySelector(".altar-companion-panel");
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

  function formatIngredient(item = {}) {
    const name = item.libraryName || item.label || item.name || "Ingredient";
    const amount = String(item.amount || "").trim();
    return amount ? `${name}: ${amount}` : name;
  }

  function getStateRows(identity, object) {
    const rows = [];
    const add = (label, value) => {
      if (value === "" || value === null || value === undefined) return;
      if (Array.isArray(value) && !value.length) return;
      rows.push({ label, value });
    };

    if (identity === "candle") {
      add("Flame", object?.classList.contains("is-lit") ? "Lit" : "Unlit");
      add("Color", object?.dataset.color || "");
      add("Dressed", object?.dataset.dressed === "true" ? "Yes" : "");
    } else if (identity === "herb") {
      add("Form", object?.dataset.form || "");
    } else if (identity === "crystal") {
      add("Form", object?.dataset.form || object?.dataset.crystalForm || "");
    } else if (identity === "deity") {
      add("Presence", "Placed on the altar");
    } else if (CRAFTED_IDENTITIES.has(identity)) {
      add("Status", object?.dataset.status || object?.dataset.activationState || "Active");
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
    const page = panel.querySelector("[data-companion-content] .companion-v3-page");
    if (!page) return;

    page.querySelector(".companion-v3-glance")?.remove();

    const identity = getIdentity(panel, object);
    const rows = getStateRows(identity, object);
    const lifecycle = panel.querySelector(".altar-companion-header [data-companion-lifecycle]");
    let section = page.querySelector("[data-companion-v4-current-state]");

    if (!rows.length && !lifecycle) {
      section?.remove();
      return;
    }

    if (!section || section.tagName === "DETAILS") {
      const replacement = document.createElement("section");
      replacement.className = "companion-v4-current-state";
      replacement.setAttribute("data-companion-v4-current-state", "");
      replacement.innerHTML = `
        <h3 class="companion-v4-current-state-title">Current State</h3>
        <div class="companion-v4-current-state-body" data-companion-v4-current-state-body></div>
      `;

      if (section) section.replaceWith(replacement);
      else page.prepend(replacement);
      section = replacement;
    }

    const body = section.querySelector("[data-companion-v4-current-state-body]");
    body.innerHTML = rows.map(renderRow).join("");
    if (lifecycle) body.appendChild(lifecycle);
  }

  function ensureRecipeSection(panel, object) {
    const page = panel.querySelector("[data-companion-content] .companion-v3-page");
    if (!page) return;

    const identity = getIdentity(panel, object);
    const existing = page.querySelector("[data-companion-v4-recipe]");

    if (!CRAFTED_IDENTITIES.has(identity)) {
      existing?.remove();
      return;
    }

    const apothecary = getApothecary(object);
    const intention = String(apothecary?.intention || "").trim();
    const ingredients = Array.isArray(apothecary?.ingredients)
      ? apothecary.ingredients.filter(Boolean)
      : [];
    const preparation = String(
      apothecary?.preparation ||
      apothecary?.instructions ||
      apothecary?.recipe ||
      apothecary?.method ||
      ""
    ).trim();

    if (!intention && !ingredients.length && !preparation) {
      existing?.remove();
      return;
    }

    const details = existing || document.createElement("details");
    details.className = "companion-v4-recipe";
    details.setAttribute("data-companion-v4-recipe", "");
    details.innerHTML = `
      <summary>Recipe</summary>
      <div class="companion-v4-recipe-body">
        ${intention ? `
          <section class="companion-v4-recipe-group">
            <strong class="companion-v4-recipe-label">Intention</strong>
            <p>${escapeHtml(intention)}</p>
          </section>
        ` : ""}
        ${ingredients.length ? `
          <section class="companion-v4-recipe-group">
            <strong class="companion-v4-recipe-label">Ingredients</strong>
            <ul class="companion-v4-ingredient-list">
              ${ingredients.map((item) => `<li>${escapeHtml(formatIngredient(item))}</li>`).join("")}
            </ul>
          </section>
        ` : ""}
        ${preparation ? `
          <section class="companion-v4-recipe-group">
            <strong class="companion-v4-recipe-label">Preparation</strong>
            <p>${escapeHtml(preparation)}</p>
          </section>
        ` : ""}
      </div>
    `;

    if (!existing) {
      const currentState = page.querySelector("[data-companion-v4-current-state]");
      if (currentState) currentState.insertAdjacentElement("afterend", details);
      else page.prepend(details);
    }
  }

  function normalizeActions(panel) {
    const apothecaryEdit = panel.querySelector("[data-apothecary-edit]");
    if (apothecaryEdit) apothecaryEdit.textContent = "Edit Apothecary Item";

    const libraryEdit = panel.querySelector('[data-library-edit-section="myPractice"]');
    if (libraryEdit) libraryEdit.textContent = "Edit Library Entry";
  }

  function ensureActionsDropdown(panel) {
    const page = panel.querySelector("[data-companion-content] .companion-v3-page");
    const footer = page?.querySelector(".companion-v3-actions");
    if (!page || !footer) return;

    const details = document.createElement("details");
    details.className = "companion-v4-actions";
    details.setAttribute("data-companion-v4-actions", "");
    details.innerHTML = `
      <summary>Actions</summary>
      <div class="companion-v4-actions-body" data-companion-v4-actions-body></div>
    `;

    const body = details.querySelector("[data-companion-v4-actions-body]");
    const buttons = Array.from(footer.querySelectorAll("button"));
    body.replaceChildren(...buttons);
    footer.replaceWith(details);
  }

  function applyCompanionV4(object = null) {
    installStyles();

    const panel = getPanel();
    if (!panel) return false;

    panel.dataset.companionVersion = "4";
    panel.querySelector("[data-companion-emphasis]")?.remove();

    const target = object || (typeof selectedObject !== "undefined" ? selectedObject : null);
    normalizeActions(panel);
    ensureCurrentState(panel, target);
    ensureRecipeSection(panel, target);
    ensureActionsDropdown(panel);
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
