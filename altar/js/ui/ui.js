/* =========================================================
   ALTAR UI
   Empty state, toast, modals, mobile cabinet, toolbar shell
   ========================================================= */

const workspacePanelStyles = document.createElement("link");
workspacePanelStyles.rel = "stylesheet";
workspacePanelStyles.href = "workspace-panel.css";
document.head.appendChild(workspacePanelStyles);

const toolbar = document.createElement("div");
toolbar.className = "altar-toolbar";
toolbar.hidden = true;
toolbar.innerHTML = `
  <button type="button" data-action="smaller" title="Make smaller">−</button>
  <button type="button" data-action="larger" title="Make larger">+</button>
  <button type="button" data-action="rotate-left" title="Rotate left">↺</button>
  <button type="button" data-action="rotate-right" title="Rotate right">↻</button>
  <button type="button" data-action="delete" title="Delete">🗑</button>
  <button type="button" data-action="forward" title="Bring forward">⬆</button>
  <button type="button" data-action="backward" title="Send backward">⬇</button>
  <button type="button" data-action="flip" title="Flip horizontally">⇋</button>
  <button type="button" data-action="lock" title="Lock position">🔒</button>
  <button type="button" data-action="duplicate" title="Duplicate">⧉</button>
  <button type="button" data-action="glow" title="Glow on/off">✦</button>
  <button type="button" data-action="light" title="Light candle">🔥</button>
  <button type="button" data-action="dress-candle" title="Dress candle">🕯️+</button>
`;

const altarActionBar = document.createElement("div");
altarActionBar.className = "altar-action-bar";
altarActionBar.innerHTML = `
  <div class="altar-action-group">
    <button type="button" data-global-action="undo">↶ Undo</button>
    <button type="button" data-global-action="redo">↷ Redo</button>
    <button type="button" data-global-action="save-altar">💾 Save</button>
    <button type="button" data-global-action="load-altar">📂 Library</button>
  </div>

  <div class="altar-action-divider"></div>

  <div class="altar-action-group">
    <button type="button" data-global-action="select-ritual-items">☑ Select</button>
    <button type="button" data-global-action="group-ritual-items">🗂 Group</button>
    <button type="button" data-global-action="start-ritual">🌙 Start Ritual</button>
    <button type="button" data-global-action="save-as-ritual">📖 Save Ritual</button>
  </div>

  <div class="altar-action-divider"></div>

  <div class="altar-action-group">
    <button type="button" data-global-action="light-all">🔥 Light</button>
    <button type="button" data-global-action="extinguish-all">💨 Out</button>
    <button type="button" data-global-action="clear-altar">🧹 Clear</button>
  </div>
`;

const altarMobileBackdrop = document.createElement("button");
altarMobileBackdrop.type = "button";
altarMobileBackdrop.className = "altar-mobile-backdrop";
altarMobileBackdrop.setAttribute("aria-label", "Close altar cabinet");

const altarToast = document.createElement("div");
altarToast.className = "altar-toast";
altarToast.hidden = true;

const altarGroupIndicator = document.createElement("div");
altarGroupIndicator.className = "altar-group-indicator";
altarGroupIndicator.hidden = true;

const altarInfoCard = document.createElement("aside");
altarInfoCard.className = "altar-info-card";
altarInfoCard.hidden = true;
altarInfoCard.setAttribute("aria-live", "polite");

const altarCompanionPanel = document.createElement("section");
altarCompanionPanel.className = "altar-companion-panel altar-workspace-module is-visible";
altarCompanionPanel.setAttribute("aria-live", "polite");
altarCompanionPanel.innerHTML = `
  <div class="altar-companion-inner">
    <div class="altar-companion-header">
      <div>
        <p class="eyebrow">Companion</p>
        <h2>Selected Object</h2>
      </div>
    </div>

    <div class="altar-companion-content" data-companion-content>
      <p>Select an object to see its details.</p>
    </div>
  </div>
`;

const altarLivingStatePanel = document.createElement("section");
altarLivingStatePanel.className = "altar-companion-panel altar-living-state-panel altar-workspace-module is-visible";
altarLivingStatePanel.setAttribute("aria-live", "polite");
altarLivingStatePanel.innerHTML = `
  <div class="altar-companion-inner">
    <div class="altar-companion-header">
      <div>
        <p class="eyebrow">Living State</p>
        <h2>Current Manifestation</h2>
      </div>
    </div>

    <div class="altar-companion-content" data-living-state-content>
      <p>Select an object with a living state.</p>
    </div>
  </div>
`;

const altarWorkspacePanel = document.createElement("aside");
altarWorkspacePanel.className = "altar-workspace-panel";
altarWorkspacePanel.setAttribute("aria-label", "Altar companion and manifestation panel");
altarWorkspacePanel.innerHTML = `<div class="altar-workspace-panel-inner"></div>`;
altarWorkspacePanel.querySelector(".altar-workspace-panel-inner").append(
  altarCompanionPanel,
  altarLivingStatePanel
);

const mobileCabinetToggle = document.createElement("button");
mobileCabinetToggle.type = "button";
mobileCabinetToggle.className = "altar-mobile-cabinet-toggle";
mobileCabinetToggle.textContent = "✦ Add Items";
mobileCabinetToggle.setAttribute("aria-expanded", "false");

function syncAltarWorkspacePanelHeight() {
  if (!altarWorkspacePanel) return;

  if (window.innerWidth <= 900) {
    altarWorkspacePanel.style.removeProperty("height");
    return;
  }

  const altarStageWrap = document.querySelector(".altar-stage-wrap");
  const altarActionBar = document.querySelector(".altar-action-bar");

  if (!altarStageWrap) return;

  const stageTop = altarStageWrap.getBoundingClientRect().top;

  const workspaceBottom = altarActionBar
    ? altarActionBar.getBoundingClientRect().bottom
    : altarStageWrap.getBoundingClientRect().bottom;

  const fullWorkspaceHeight = Math.round(workspaceBottom - stageTop);

  if (fullWorkspaceHeight > 0) {
    altarWorkspacePanel.style.height = `${fullWorkspaceHeight}px`;
  }
}

if (altarStage) {

  const altarWorkspace = altarStage.closest(".altar-workspace");
  const altarStageWrap = altarStage.closest(".altar-stage-wrap");

  const companionToggle = document.createElement("button");
  companionToggle.type = "button";
  companionToggle.className = "altar-companion-toggle";
  companionToggle.setAttribute("data-companion-toggle", "");
  companionToggle.setAttribute("aria-label", "Minimize companion panel");
  companionToggle.setAttribute("aria-expanded", "true");
  companionToggle.textContent = "−";

  const altarWorkspaceTools = document.querySelector(".altar-workspace-tools");

  if (altarWorkspaceTools) {
    altarWorkspaceTools.prepend(companionToggle);
  }

  if (altarWorkspace && altarStageWrap) {
    altarWorkspace.insertBefore(altarWorkspacePanel, altarStageWrap);
  }

  const lightingCanvas = document.createElement("canvas");
  lightingCanvas.className = "altar-lighting-layer";
  lightingCanvas.setAttribute("data-lighting-layer", "");

  altarStage.appendChild(lightingCanvas);

  altarStage.after(altarActionBar);
  altarStage.appendChild(toolbar);
  altarStage.appendChild(altarGroupIndicator);
  altarStage.appendChild(altarInfoCard);

  const altarStageResizeObserver = new ResizeObserver(syncAltarWorkspacePanelHeight);
  altarStageResizeObserver.observe(altarStage);
  window.addEventListener("resize", syncAltarWorkspacePanelHeight);
  window.requestAnimationFrame(syncAltarWorkspacePanelHeight);
}

if (altarCabinet) {
  document.body.appendChild(altarMobileBackdrop);
  document.body.appendChild(mobileCabinetToggle);
  document.body.appendChild(altarToast);
}

function setAltarWorkspacePanelMinimized(isMinimized) {
  document.body.classList.toggle("altar-companion-minimized", isMinimized);
  altarWorkspacePanel.classList.toggle("is-minimized", isMinimized);

  document.querySelectorAll("[data-companion-toggle]").forEach((button) => {
    button.textContent = isMinimized ? "☰" : "−";
    button.setAttribute("aria-expanded", String(!isMinimized));
    button.setAttribute(
      "aria-label",
      isMinimized ? "Open companion panel" : "Minimize companion panel"
    );
  });

  window.requestAnimationFrame(() => {
    syncAltarWorkspacePanelHeight();

    if (typeof repositionAllObjectsFromPercent === "function") {
      repositionAllObjectsFromPercent();
    }

    if (typeof resizeLightingCanvas === "function") {
      resizeLightingCanvas();
    }

    if (typeof renderLighting === "function") {
      renderLighting();
    }
  });
}

document.addEventListener(
  "click",
  (event) => {
    const toggle = event.target.closest("[data-companion-toggle]");
    if (!toggle) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const isCurrentlyMinimized = document.body.classList.contains("altar-companion-minimized");
    setAltarWorkspacePanelMinimized(!isCurrentlyMinimized);

    if (typeof showAltarToast === "function") {
      showAltarToast(isCurrentlyMinimized ? "Panel opened" : "Panel minimized");
    }
  },
  true
);

function updateEmptyMessage() {
  if (!altarStage || !emptyMessage) return;
  emptyMessage.hidden = altarStage.querySelectorAll(".altar-object").length > 0;
}

function showAltarToast(message) {
  if (!altarToast) return;

  altarToast.textContent = message;
  altarToast.hidden = false;
  altarToast.classList.add("is-visible");

  window.clearTimeout(showAltarToast.timeout);

  showAltarToast.timeout = window.setTimeout(() => {
    altarToast.classList.remove("is-visible");

    window.setTimeout(() => {
      altarToast.hidden = true;
    }, 250);
  }, 1600);
}

function closeMobileCabinet() {
  if (!altarCabinet) return;

  altarCabinet.classList.remove("is-mobile-open");
  document.body.classList.remove("altar-cabinet-open");
  mobileCabinetToggle.setAttribute("aria-expanded", "false");
}

function openSaveModal() {
  if (!saveModal) return;

  saveModal.hidden = false;
  document.body.classList.add("altar-modal-open");
}

function closeSaveModal() {
  if (!saveModal) return;

  saveModal.hidden = true;
  document.body.classList.remove("altar-modal-open");
}

altarMobileBackdrop.addEventListener("click", closeMobileCabinet);
