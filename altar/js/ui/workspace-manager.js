/* =========================================================
   ALTAR WORKSPACE MANAGER
   Single source of truth for Companion + Practice layout state
   ========================================================= */

(() => {
  const state = {
    mode: "normal",
    ritualActive: false,
    companionVisible: true,
    practiceVisible: false,
    selectedObject: null,
    scroll: {
      companion: 0,
      practice: 0
    }
  };

  let workspacePanel = null;
  let companionPanel = null;
  let practicePanel = null;
  let companionContent = null;
  let practiceContent = null;
  let applyingState = false;

  function discoverElements() {
    workspacePanel = document.querySelector(".altar-workspace-panel");
    companionPanel = document.querySelector(
      ".altar-companion-panel:not(.altar-living-state-panel)"
    );
    practicePanel = document.querySelector(".altar-living-state-panel");
    companionContent = companionPanel?.querySelector("[data-companion-content]") || null;
    practiceContent = practicePanel?.querySelector("[data-living-state-content]") || null;

    bindScrollMemory(companionContent, "companion");
    bindScrollMemory(practiceContent, "practice");

    return Boolean(workspacePanel && companionPanel && practicePanel);
  }

  function bindScrollMemory(element, key) {
    if (!element || element.dataset.workspaceScrollBound === "true") return;

    element.dataset.workspaceScrollBound = "true";
    element.addEventListener(
      "scroll",
      () => {
        state.scroll[key] = element.scrollTop;
      },
      { passive: true }
    );
  }

  function restoreScrollPositions() {
    window.requestAnimationFrame(() => {
      if (companionContent) companionContent.scrollTop = state.scroll.companion;
      if (practiceContent) practiceContent.scrollTop = state.scroll.practice;
    });
  }

  function deriveMode() {
    if (state.ritualActive) return "ritual";
    if (state.companionVisible && state.practiceVisible) return "split";
    if (state.companionVisible) return "companion-only";
    if (state.practiceVisible) return "practice-only";
    return "hidden";
  }

  function updateToggleButtons() {
    const workspaceOpen = state.companionVisible || state.practiceVisible;

    document
      .querySelectorAll("[data-companion-toggle], [data-companion-minimize]")
      .forEach((button) => {
        button.textContent = workspaceOpen ? "−" : "☰";
        button.setAttribute("aria-expanded", String(workspaceOpen));
        button.setAttribute(
          "aria-label",
          workspaceOpen ? "Minimize workspace panel" : "Open workspace panel"
        );
      });

    document.querySelectorAll("[data-living-state-minimize]").forEach((button) => {
      button.setAttribute("aria-expanded", String(state.practiceVisible));
      button.setAttribute(
        "aria-label",
        state.practiceVisible ? "Minimize Practice" : "Open Practice"
      );
    });
  }

  function applyState() {
    if (!discoverElements()) return;

    applyingState = true;
    state.mode = deriveMode();

    workspacePanel.dataset.workspaceMode = state.mode;
    document.body.dataset.altarWorkspaceMode = state.mode;
    document.body.classList.toggle("ritual-session-active", state.ritualActive);
    document.body.classList.toggle("altar-companion-minimized", state.mode === "hidden");
    document.body.classList.toggle(
      "altar-living-state-minimized",
      !state.practiceVisible || state.ritualActive
    );

    const companionShown = state.companionVisible || state.ritualActive;
    const practiceShown = state.practiceVisible && !state.ritualActive;

    companionPanel.classList.toggle("is-minimized", !companionShown);
    companionPanel.classList.toggle("is-visible", companionShown);
    practicePanel.classList.toggle("is-minimized", !practiceShown);
    practicePanel.classList.toggle("is-visible", practiceShown);

    updateToggleButtons();
    restoreScrollPositions();

    window.requestAnimationFrame(() => {
      applyingState = false;

      if (typeof syncAltarWorkspacePanelHeight === "function") {
        syncAltarWorkspacePanelHeight();
      }

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

  function setMode(mode) {
    switch (mode) {
      case "ritual":
        state.ritualActive = true;
        state.companionVisible = true;
        break;
      case "companion-only":
        state.ritualActive = false;
        state.companionVisible = true;
        state.practiceVisible = false;
        break;
      case "practice-only":
        state.ritualActive = false;
        state.companionVisible = false;
        state.practiceVisible = true;
        break;
      case "split":
      case "normal":
        state.ritualActive = false;
        state.companionVisible = true;
        state.practiceVisible = true;
        break;
      case "hidden":
        state.ritualActive = false;
        state.companionVisible = false;
        state.practiceVisible = false;
        break;
      default:
        return;
    }

    applyState();
  }

  function setSelectedObject(object) {
    state.selectedObject = object || null;
  }

  function setCompanionVisible(visible) {
    state.companionVisible = Boolean(visible);
    applyState();
  }

  function setPracticeVisible(visible) {
    state.practiceVisible = Boolean(visible);
    applyState();
  }

  function setRitualActive(active) {
    state.ritualActive = Boolean(active);
    if (state.ritualActive) state.companionVisible = true;
    applyState();
  }

  function toggleWorkspace() {
    const isOpen = state.companionVisible || state.practiceVisible;

    if (isOpen) {
      state.companionVisible = false;
      state.practiceVisible = false;
    } else {
      state.companionVisible = true;
      state.practiceVisible = Boolean(
        practicePanel?.classList.contains("is-visible") &&
        practicePanel?.querySelector("[data-living-state-content]")
      );
    }

    applyState();

    if (typeof showAltarToast === "function") {
      showAltarToast(isOpen ? "Workspace minimized" : "Workspace opened");
    }
  }

  function togglePractice() {
    state.practiceVisible = !state.practiceVisible;
    applyState();

    if (typeof showAltarToast === "function") {
      showAltarToast(state.practiceVisible ? "Practice opened" : "Practice minimized");
    }
  }

  function syncFromDom() {
    if (applyingState || !discoverElements()) return;

    state.selectedObject = document.querySelector(".altar-object.is-selected");
    state.ritualActive = document.body.classList.contains("ritual-session-active");
    state.companionVisible = !companionPanel.classList.contains("is-minimized");
    state.practiceVisible =
      practicePanel.classList.contains("is-visible") &&
      !practicePanel.classList.contains("is-minimized");

    applyState();
  }

  document.addEventListener(
    "click",
    (event) => {
      const workspaceToggle = event.target.closest(
        "[data-companion-toggle], [data-companion-minimize]"
      );
      const practiceToggle = event.target.closest("[data-living-state-minimize]");

      if (!workspaceToggle && !practiceToggle) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      discoverElements();

      if (workspaceToggle) toggleWorkspace();
      if (practiceToggle) togglePractice();
    },
    true
  );

  const observer = new MutationObserver((mutations) => {
    if (applyingState) return;

    const relevant = mutations.some((mutation) => {
      if (mutation.type === "childList") return true;
      if (mutation.type !== "attributes") return false;

      return (
        mutation.attributeName === "class" ||
        mutation.attributeName === "hidden" ||
        mutation.attributeName === "data-workspace-mode"
      );
    });

    if (relevant) window.requestAnimationFrame(syncFromDom);
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "data-workspace-mode"]
  });

  window.addEventListener("resize", applyState);
  document.addEventListener("DOMContentLoaded", () => {
    discoverElements();
    syncFromDom();
  });

  window.AltarWorkspace = {
    state,
    applyState,
    setMode,
    setSelectedObject,
    setCompanionVisible,
    setPracticeVisible,
    setRitualActive,
    toggleWorkspace,
    togglePractice,
    syncFromDom
  };
})();
