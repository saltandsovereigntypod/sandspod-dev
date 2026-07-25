/* =========================================================
   COMPANION V4 POLISH
   Gives every Companion section one consistent field-guide treatment and
   guarantees every action button lives inside the same compact dropdown.
   ========================================================= */

(function initializeCompanionV4Polish() {
  const STYLE_ID = "companion-v4-polish-styles";
  const ACTION_SELECTOR = [
    "[data-living-state-practice]",
    "[data-apothecary-edit]",
    "[data-library-edit-section]",
    "[data-manage-library-relationships]",
    "[data-open-living-history]"
  ].join(",");

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .altar-companion-panel[data-companion-version="4"] .companion-v3-page {
        gap: 0.55rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-current-state,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-section,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions {
        border: 1px solid rgba(190, 157, 92, 0.34);
        border-radius: 0.8rem;
        background: rgba(18, 17, 14, 0.72);
        box-shadow: none;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section > summary,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe > summary,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions > summary {
        min-height: 42px;
        padding: 0.62rem 0.85rem;
        color: var(--gold, #c8a96b);
        font-family: Georgia, serif;
        font-size: 0.95rem;
        font-weight: 700;
        line-height: 1.15;
        background: transparent;
        border: 0;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section[open] > summary,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe[open] > summary,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions[open] > summary {
        border-bottom: 1px solid rgba(190, 157, 92, 0.18);
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section-body,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe-body,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body {
        padding: 0.7rem 0.85rem 0.8rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-current-state {
        padding: 0.7rem 0.85rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-current-state-title {
        margin: 0 0 0.45rem;
        color: var(--gold, #c8a96b);
        font-family: Georgia, serif;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section-body h4,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe-label,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-state-row strong {
        color: rgba(238, 224, 194, 0.84);
        font-size: 0.68rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-section-body p,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-section-body div,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-recipe-body,
      .altar-companion-panel[data-companion-version="4"] .companion-v4-current-state-body {
        color: rgba(245, 237, 220, 0.94);
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-journal-fields,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-event-list,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-relationship-group {
        display: grid;
        gap: 0.6rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-journal-field,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-event {
        padding: 0.6rem 0;
        border-bottom: 1px solid rgba(190, 157, 92, 0.14);
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-journal-field:last-child,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-event:last-child {
        border-bottom: 0;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-relationship-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.55rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-relationship-chip {
        width: auto;
        min-height: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: var(--gold, #c8a96b);
        text-decoration: underline;
        text-underline-offset: 0.18em;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.45rem;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body > button {
        appearance: none;
        min-height: 34px;
        width: 100%;
        margin: 0;
        padding: 0.45rem 0.65rem;
        border: 1px solid rgba(190, 157, 92, 0.34);
        border-radius: 0.65rem;
        background: rgba(255, 255, 255, 0.035);
        color: rgba(245, 237, 220, 0.96);
        font: inherit;
        font-size: 0.78rem;
        line-height: 1.15;
        text-align: center;
        box-shadow: none;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body > button:hover {
        border-color: rgba(200, 169, 107, 0.62);
        background: rgba(200, 169, 107, 0.08);
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body > button:focus-visible {
        outline: 2px solid rgba(200, 169, 107, 0.8);
        outline-offset: 2px;
      }

      .altar-companion-panel[data-companion-version="4"] .companion-v3-actions,
      .altar-companion-panel[data-companion-version="4"] .companion-v3-secondary-actions:empty {
        display: none !important;
      }

      @media (max-width: 560px) {
        .altar-companion-panel[data-companion-version="4"] .companion-v4-actions-body {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getPanel() {
    return document.querySelector(".altar-companion-panel");
  }

  function createActionsDropdown() {
    const details = document.createElement("details");
    details.className = "companion-v4-actions";
    details.setAttribute("data-companion-v4-actions", "");
    details.innerHTML = `
      <summary>Actions</summary>
      <div class="companion-v4-actions-body" data-companion-v4-actions-body></div>
    `;
    return details;
  }

  function normalizeButtonLabels(panel) {
    const apothecaryEdit = panel.querySelector("[data-apothecary-edit]");
    if (apothecaryEdit) apothecaryEdit.textContent = "Edit Apothecary Item";

    const libraryEdit = panel.querySelector('[data-library-edit-section="myPractice"]');
    if (libraryEdit) libraryEdit.textContent = "Edit Library Entry";
  }

  function ensureActionsDropdown(panel) {
    const page = panel.querySelector("[data-companion-content] .companion-v3-page");
    if (!page) return;

    normalizeButtonLabels(panel);

    let details = page.querySelector("[data-companion-v4-actions]");
    if (!details) {
      details = createActionsDropdown();
      page.appendChild(details);
    }

    const body = details.querySelector("[data-companion-v4-actions-body]");
    if (!body) return;

    const actionButtons = Array.from(page.querySelectorAll(ACTION_SELECTOR))
      .filter((button) => !body.contains(button));

    actionButtons.forEach((button) => body.appendChild(button));

    page.querySelectorAll(".companion-v3-actions, .companion-v3-secondary-actions").forEach((container) => {
      if (!container.querySelector("button")) container.remove();
    });

    if (!body.querySelector("button")) details.remove();
  }

  function polishPanel() {
    installStyles();

    const panel = getPanel();
    if (!panel) return false;

    panel.dataset.companionVersion = "4";
    panel.querySelector("[data-companion-emphasis]")?.remove();
    ensureActionsDropdown(panel);
    return true;
  }

  function schedulePolish() {
    queueMicrotask(polishPanel);
    requestAnimationFrame(polishPanel);
    window.setTimeout(polishPanel, 80);
    window.setTimeout(polishPanel, 220);
    window.setTimeout(polishPanel, 600);
  }

  window.polishCompanionV4 = schedulePolish;

  document.addEventListener("companion:refreshed", schedulePolish);
  document.addEventListener("companion:refresh", schedulePolish);
  window.addEventListener("saltSettingsChanged", schedulePolish);

  schedulePolish();
})();
