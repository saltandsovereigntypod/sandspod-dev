(function initializeAccessibility(global) {
  "use strict";

  const STORAGE_PREFIX = "saltAndSovereigntyAccessibility";
  const SCALES = [0.9, 1, 1.1, 1.2, 1.3];
  const DEFAULTS = Object.freeze({
    textScale: 1,
    lineSpacing: false,
    letterSpacing: false,
    readableFont: false,
    highContrast: false,
    reduceMotion: false,
    hideDecoration: false,
    readingRuler: false,
    focusMode: false
  });
  const BOOLEAN_KEYS = Object.keys(DEFAULTS).filter((key) => typeof DEFAULTS[key] === "boolean");
  let scope = "guest";
  let state = { ...DEFAULTS };
  let trigger = null;
  let panel = null;
  let ruler = null;

  function storageKey(value = scope) { return `${STORAGE_PREFIX}:${value}`; }

  function normalize(candidate) {
    const output = { ...DEFAULTS };
    if (SCALES.includes(Number(candidate?.textScale))) output.textScale = Number(candidate.textScale);
    BOOLEAN_KEYS.forEach((key) => { if (typeof candidate?.[key] === "boolean") output[key] = candidate[key]; });
    return output;
  }

  function read(nextScope = scope, storage = global.localStorage) {
    try { return normalize(JSON.parse(storage?.getItem(storageKey(nextScope)) || "{}")); }
    catch (_) { return { ...DEFAULTS }; }
  }

  function persist(storage = global.localStorage) {
    try {
      const saved = { ...state, focusMode: false };
      storage?.setItem(storageKey(), JSON.stringify(saved));
      return true;
    } catch (_) {
      console.warn("Accessibility preferences could not be stored.", { code: "storage_unavailable" });
      return false;
    }
  }

  function apply(next = state) {
    state = normalize(next);
    const root = document.documentElement;
    root.style.setProperty("--accessibility-text-scale", String(state.textScale));
    for (const key of BOOLEAN_KEYS) root.classList.toggle(`a11y-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, state[key]);
    if (ruler) ruler.hidden = !state.readingRuler;
    updatePanel();
    return { ...state };
  }

  function setScope(user) {
    const nextScope = user?.id ? `user:${user.id}` : "guest";
    if (nextScope === scope) return;
    scope = nextScope;
    apply(read(scope));
  }

  function announce(message) {
    const status = panel?.querySelector("[data-accessibility-status]");
    if (status) status.textContent = message;
  }

  function change(key, value, message) {
    apply({ ...state, [key]: value });
    persist();
    announce(message);
  }

  function updatePanel() {
    if (!panel) return;
    panel.querySelectorAll("[data-accessibility-toggle]").forEach((button) => {
      const pressed = Boolean(state[button.dataset.accessibilityToggle]);
      button.setAttribute("aria-pressed", String(pressed));
      button.classList.toggle("is-active", pressed);
    });
    const scale = panel.querySelector("[data-accessibility-scale]");
    if (scale) scale.textContent = `${Math.round(state.textScale * 100)}%`;
  }

  function closePanel() {
    if (!panel?.open) return;
    panel.close();
    trigger?.focus({ preventScroll: true });
  }

  function mount() {
    if (!document.body || document.querySelector("[data-accessibility-trigger]")) return;
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "button button--ghost accessibility-trigger";
    trigger.dataset.accessibilityTrigger = "";
    trigger.textContent = "Accessibility Options";

    panel = document.createElement("dialog");
    panel.className = "accessibility-panel";
    panel.dataset.accessibilityPanel = "";
    panel.setAttribute("aria-labelledby", "accessibility-panel-title");
    panel.innerHTML = `
      <form method="dialog" class="accessibility-panel-card">
        <button class="accessibility-panel-close" type="button" data-close-accessibility aria-label="Close accessibility options">×</button>
        <p class="eyebrow">The Sanctuary</p><h2 id="accessibility-panel-title">Accessibility Options</h2>
        <section><h3>Text</h3><div class="accessibility-control-row"><button class="button button--ghost" type="button" data-text-step="-1" aria-label="Decrease text size">A−</button><button class="button button--ghost" type="button" data-text-reset>Reset <span data-accessibility-scale>100%</span></button><button class="button button--ghost" type="button" data-text-step="1" aria-label="Increase text size">A+</button></div></section>
        <section><h3>Reading</h3><div class="accessibility-control-grid"><button class="button button--ghost" type="button" data-accessibility-toggle="lineSpacing">Line spacing</button><button class="button button--ghost" type="button" data-accessibility-toggle="letterSpacing">Letter spacing</button><button class="button button--ghost" type="button" data-accessibility-toggle="readableFont">Readable font</button></div></section>
        <section><h3>Display</h3><div class="accessibility-control-grid"><button class="button button--ghost" type="button" data-accessibility-toggle="highContrast">High contrast</button><button class="button button--ghost" type="button" data-accessibility-toggle="reduceMotion">Reduce motion</button><button class="button button--ghost" type="button" data-accessibility-toggle="hideDecoration">Hide decoration</button></div></section>
        <section><h3>Focus</h3><div class="accessibility-control-grid"><button class="button button--ghost" type="button" data-accessibility-toggle="readingRuler">Reading ruler</button><button class="button button--ghost" type="button" data-accessibility-toggle="focusMode">Focus mode</button></div></section>
        <button class="button button--ghost" type="button" data-accessibility-reset>Reset all</button>
        <p class="sr-only" role="status" aria-live="polite" data-accessibility-status></p>
      </form>`;

    ruler = document.createElement("div");
    ruler.className = "accessibility-reading-ruler";
    ruler.setAttribute("aria-hidden", "true");
    ruler.hidden = !state.readingRuler;
    document.body.append(trigger, panel, ruler);

    trigger.addEventListener("click", () => { panel.showModal(); panel.querySelector("[data-close-accessibility]")?.focus(); });
    panel.querySelector("[data-close-accessibility]").addEventListener("click", closePanel);
    panel.addEventListener("click", (event) => { if (event.target === panel) closePanel(); });
    panel.addEventListener("close", () => trigger?.focus({ preventScroll: true }));
    panel.addEventListener("cancel", (event) => { event.preventDefault(); closePanel(); });
    panel.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-accessibility-toggle]");
      if (toggle) change(toggle.dataset.accessibilityToggle, !state[toggle.dataset.accessibilityToggle], `${toggle.textContent.trim()} ${state[toggle.dataset.accessibilityToggle] ? "disabled" : "enabled"}.`);
      const step = event.target.closest("[data-text-step]");
      if (step) { const index = SCALES.indexOf(state.textScale); change("textScale", SCALES[Math.max(0, Math.min(SCALES.length - 1, index + Number(step.dataset.textStep)))], "Text size updated."); }
      if (event.target.closest("[data-text-reset]")) change("textScale", 1, "Text size reset.");
      if (event.target.closest("[data-accessibility-reset]")) { apply({ ...DEFAULTS }); persist(); announce("All accessibility preferences reset."); }
    });
    document.addEventListener("pointermove", (event) => {
      if (!state.readingRuler || event.pointerType === "touch") return;
      const overAltar = Boolean(event.target.closest?.(".altar-stage, .altar-object, [role=dialog]"));
      ruler.hidden = overAltar;
      if (!overAltar) ruler.style.setProperty("--reading-ruler-y", `${event.clientY}px`);
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.focusMode && !panel.open) change("focusMode", false, "Focus mode disabled.");
    });
    updatePanel();
  }

  const api = { DEFAULTS, SCALES, normalize, storageKey, read, apply, setScope, getState: () => ({ ...state }) };
  global.SaltAccessibility = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  state = read("guest");
  if (typeof document !== "undefined") {
    apply(state);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
    else mount();
    document.addEventListener("saltAuthChanged", (event) => setScope(event.detail?.user || null));
    document.addEventListener("saltAuthSignedOut", () => setScope(null));
    document.addEventListener("saltAuthReady", () => setScope(global.getCurrentSaltUser?.() || null));
  }
})(typeof window !== "undefined" ? window : globalThis);
