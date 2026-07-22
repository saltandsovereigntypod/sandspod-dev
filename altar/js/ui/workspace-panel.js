/* =========================================================
   UNIFIED ALTAR WORKSPACE CONTROLLER
   Owns layout, visibility, resizing, and ritual takeover only.
   Companion and Living State content remain independently rendered.
   ========================================================= */

const altarWorkspaceState = {
  minimized: false,
  ritualActive: document.body.classList.contains("ritual-session-active"),
  companionHasContext: false,
  livingStateHasContext: false
};

function getAltarWorkspaceElements() {
  return {
    workspace: document.querySelector(".altar-workspace"),
    panel: document.querySelector(".altar-workspace-panel"),
    panelInner: document.querySelector(".altar-workspace-panel-inner"),
    stage: document.querySelector("[data-altar-stage]"),
    companion: document.querySelector(".altar-workspace-module:not(.altar-living-state-panel)"),
    livingState: document.querySelector(".altar-living-state-panel")
  };
}

function workspaceModuleHasContext(module, emptyMessages = []) {
  if (!module || module.classList.contains("is-minimized")) return false;

  const content = module.querySelector(".altar-companion-content");
  if (!content) return false;

  const normalizedText = content.textContent.replace(/\s+/g, " ").trim();
  if (!normalizedText) return false;

  return !emptyMessages.some((message) => normalizedText === message);
}

function readAltarWorkspaceState() {
  const { companion, livingState } = getAltarWorkspaceElements();

  altarWorkspaceState.minimized = document.body.classList.contains("altar-companion-minimized");
  altarWorkspaceState.ritualActive = document.body.classList.contains("ritual-session-active");
  altarWorkspaceState.companionHasContext = workspaceModuleHasContext(companion, [
    "Select an object to see its details."
  ]);
  altarWorkspaceState.livingStateHasContext = workspaceModuleHasContext(livingState, [
    "Select an object with a living state.",
    "No living state has been created for this object yet."
  ]);
}

function syncAltarWorkspaceHeight() {
  const { panel, stage } = getAltarWorkspaceElements();
  if (!panel || !stage) return;

  const stageHeight = Math.round(stage.getBoundingClientRect().height);
  if (stageHeight > 0) {
    panel.style.height = `${stageHeight}px`;
  }
}

function syncAltarWorkspaceToggle() {
  document.querySelectorAll("[data-companion-toggle]").forEach((button) => {
    button.textContent = altarWorkspaceState.minimized ? "☰" : "−";
    button.setAttribute("aria-expanded", String(!altarWorkspaceState.minimized));
    button.setAttribute(
      "aria-label",
      altarWorkspaceState.minimized
        ? "Open companion and manifestation panel"
        : "Minimize companion and manifestation panel"
    );
  });
}

function applyAltarWorkspaceState() {
  const { panel, companion, livingState } = getAltarWorkspaceElements();
  if (!panel || !companion || !livingState) return;

  readAltarWorkspaceState();

  panel.classList.toggle("is-minimized", altarWorkspaceState.minimized);
  panel.classList.toggle("is-ritual-mode", altarWorkspaceState.ritualActive);

  companion.classList.toggle(
    "workspace-module-inactive",
    !altarWorkspaceState.ritualActive && !altarWorkspaceState.companionHasContext && altarWorkspaceState.livingStateHasContext
  );

  livingState.classList.toggle(
    "workspace-module-inactive",
    altarWorkspaceState.ritualActive || !altarWorkspaceState.livingStateHasContext
  );

  panel.dataset.workspaceLayout = altarWorkspaceState.ritualActive
    ? "ritual"
    : altarWorkspaceState.companionHasContext && altarWorkspaceState.livingStateHasContext
      ? "split"
      : altarWorkspaceState.livingStateHasContext
        ? "living-state"
        : "companion";

  syncAltarWorkspaceToggle();
  syncAltarWorkspaceHeight();
}

function setAltarWorkspaceMinimized(isMinimized) {
  document.body.classList.toggle("altar-companion-minimized", isMinimized);
  document.body.classList.remove("altar-living-state-minimized");
  altarWorkspaceState.minimized = isMinimized;

  applyAltarWorkspaceState();

  window.requestAnimationFrame(() => {
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
    const toggle = event.target.closest("[data-companion-toggle], [data-companion-minimize], [data-living-state-minimize]");
    if (!toggle) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    setAltarWorkspaceMinimized(!document.body.classList.contains("altar-companion-minimized"));

    if (typeof showAltarToast === "function") {
      showAltarToast(
        document.body.classList.contains("altar-companion-minimized")
          ? "Panel minimized"
          : "Panel opened"
      );
    }
  },
  true
);

const altarWorkspaceElements = getAltarWorkspaceElements();

if (altarWorkspaceElements.stage && typeof ResizeObserver !== "undefined") {
  const stageResizeObserver = new ResizeObserver(syncAltarWorkspaceHeight);
  stageResizeObserver.observe(altarWorkspaceElements.stage);
}

if (altarWorkspaceElements.panel && typeof MutationObserver !== "undefined") {
  const workspaceObserver = new MutationObserver(applyAltarWorkspaceState);

  workspaceObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  workspaceObserver.observe(altarWorkspaceElements.panel, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

window.addEventListener("resize", syncAltarWorkspaceHeight);
document.addEventListener("saltRitualSessionStarted", applyAltarWorkspaceState);
document.addEventListener("saltRitualSessionCompleted", applyAltarWorkspaceState);
document.addEventListener("saltRitualSessionEnded", applyAltarWorkspaceState);

window.requestAnimationFrame(applyAltarWorkspaceState);
