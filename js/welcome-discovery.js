(function initializeWelcomeDiscovery(global) {
  const DAILY_REFLECTION_KEY = "saltAndSovereigntyDailyThresholdReflection";
  const DESTINATION_KEY = "saltAndSovereigntySanctuaryDestination";
  const GUIDE_VERSION = "1.2.5";
  const GUIDE_KEYS = {
    altar: "saltAndSovereigntyAltarGuideVersion",
    grimoire: "saltAndSovereigntyGrimoireGuideVersion"
  };

  const REFLECTIONS = [
    { id: "arrive", text: "You are welcome to arrive exactly as you are." },
    { id: "performance", text: "What might soften if you did not have to perform here?" },
    { id: "reclaim", text: "What part of yourself is ready to be welcomed home?" },
    { id: "rest", text: "Rest can be a way of returning to your own wisdom." },
    { id: "sovereignty", text: "What choice would feel most like your own today?" },
    { id: "tenderness", text: "Where might tenderness be more useful than pressure?" },
    { id: "truth", text: "What truth can you hold gently, without needing to act on it yet?" },
    { id: "boundaries", text: "What boundary would help you remain present with yourself?" },
    { id: "listening", text: "You do not have to force an answer. You may simply listen inward." },
    { id: "lay-down", text: "What would you like to lay down before you enter?" }
  ];

  const GUIDES = {
    altar: {
      label: "Digital Altar",
      steps: [
        ["A space for your practice", "The Digital Altar is a flexible place to arrange meaningful objects, explore correspondences, and hold personal ritual work. Nothing here is required."],
        ["Choose what belongs", "Open the Cabinet for altar objects or My Apothecary for crafted items. Place only what supports the practice you are tending."],
        ["Work with objects", "Select an object to move, resize, rotate, layer, lock, duplicate, or remove it when those actions apply. The bottom toolbar shows the most useful actions; See More holds the rest."],
        ["Meet the Companion", "The Companion explains the selected object through Current State, Traditional Information, My Practice, Relationships, and History & Activity."],
        ["Follow guided actions", "Object actions can light or dress candles, cleanse or charge crystals, record dedications and offerings, and edit your own practice information."],
        ["Begin a ritual", "Start freely or use a Ritual Template. Completed Ritual Sessions can become journal entries connected to your Book of Shadows and Living Library."],
        ["Return to your work", "Guest work stays in this browser and may be lost if its data is cleared. A Sanctuary account can save supported altar, ritual, Library, and apothecary work to the cloud for supported devices."]
      ]
    },
    grimoire: {
      label: "Book of Shadows",
      steps: [
        ["A living record", "The Book of Shadows holds pages, ritual journals, and the Living Library—the canonical collection of herbs, crystals, deities, tools, practices, and other entities."],
        ["Independent knowledge layers", "My Practice, Traditional Information, and Community Grimoire are separate layers on the same entity. Hiding a layer changes what you see, not the identity of the entity or your saved notes."],
        ["When Traditional is hidden", "Traditional entities and pages stay out of view, while My Practice and enabled Community content can remain visible. The internal Traditional Library can still help link a new My Practice entry."],
        ["Create My Practice", "Choose a category, search for a canonical Traditional entry, and add your own layer to that entity. If no match belongs, create a completely custom entity instead."],
        ["Keep building connections", "Every entity page can add or edit My Practice. Relationships connect related entries, while Rituals, Templates, Spells, and Apothecary records remain available in their existing sections."],
        ["Rituals become records", "A completed Ritual Session can create or update a ritual journal and Book of Shadows page, retaining the altar and Living Library connections that were actually recorded."],
        ["Read in your own language", "Mundane Mode offers less overtly magical wording. Guest work remains in this browser; a Sanctuary account can cloud-save supported Book, Library, ritual, and practice data across supported devices."]
      ]
    }
  };

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function readStoredJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key)) || null;
    } catch {
      return null;
    }
  }

  function selectDailyReflection(storage, date = new Date(), random = Math.random, reflections = REFLECTIONS) {
    const localDate = getLocalDateKey(date);
    const stored = readStoredJson(storage, DAILY_REFLECTION_KEY);
    const existing = reflections.find((reflection) => reflection.id === stored?.currentId);
    if (stored?.date === localDate && existing) return existing;

    const previousId = existing?.id || stored?.previousId || null;
    const candidates = reflections.length > 1
      ? reflections.filter((reflection) => reflection.id !== previousId)
      : reflections;
    const safeRandom = Math.min(Math.max(Number(random()) || 0, 0), 0.999999);
    const selected = candidates[Math.floor(safeRandom * candidates.length)] || reflections[0];

    storage.setItem(DAILY_REFLECTION_KEY, JSON.stringify({
      date: localDate,
      currentId: selected.id,
      previousId
    }));
    return selected;
  }

  function normalizeDestination(destination) {
    const value = String(destination || "");
    if (/^(?:\.\/|\/)?altar\/?(?:index\.html)?$/.test(value)) return "/altar/";
    if (/^(?:\.\/|\/)?grimoire\/?(?:index\.html)?$/.test(value)) return "/grimoire/";
    return null;
  }

  function rememberDestination(storage, destination) {
    const normalized = normalizeDestination(destination);
    if (normalized) storage.setItem(DESTINATION_KEY, normalized);
    return normalized;
  }

  function consumeDestination(storage) {
    const destination = normalizeDestination(storage.getItem(DESTINATION_KEY));
    storage.removeItem(DESTINATION_KEY);
    return destination;
  }

  function isGuideComplete(storage, kind) {
    return Boolean(GUIDE_KEYS[kind]) && storage.getItem(GUIDE_KEYS[kind]) === GUIDE_VERSION;
  }

  function completeGuide(storage, kind) {
    if (!GUIDE_KEYS[kind]) return false;
    storage.setItem(GUIDE_KEYS[kind], GUIDE_VERSION);
    return true;
  }

  function renderDailyThresholdReflection() {
    const target = document.querySelector("[data-threshold-question]");
    if (!target) return;
    target.textContent = selectDailyReflection(localStorage).text;
  }

  let activeGuide = null;

  function openGuide(kind, { manual = false, opener = document.activeElement } = {}) {
    const guide = GUIDES[kind];
    if (!guide || activeGuide || (!manual && isGuideComplete(localStorage, kind))) return false;

    let stepIndex = 0;
    const modal = document.createElement("div");
    modal.className = "tool-guide-modal";
    modal.dataset.toolGuideModal = kind;
    modal.innerHTML = `
      <button class="tool-guide-backdrop" type="button" data-guide-close aria-label="Close guide"></button>
      <section class="tool-guide-card" role="dialog" aria-modal="true" aria-labelledby="tool-guide-title" tabindex="-1">
        <button class="tool-guide-close" type="button" data-guide-close>Close</button>
        <p class="eyebrow">How This Works · ${guide.label}</p>
        <p class="tool-guide-progress" data-guide-progress></p>
        <h2 id="tool-guide-title" data-guide-title></h2>
        <p data-guide-copy></p>
        <div class="tool-guide-actions">
          <button class="button button--ghost" type="button" data-guide-skip>Skip</button>
          <span class="tool-guide-spacer"></span>
          <button class="button" type="button" data-guide-back>Back</button>
          <button class="button button--primary" type="button" data-guide-next>Next</button>
        </div>
      </section>`;

    const card = modal.querySelector(".tool-guide-card");
    const progress = modal.querySelector("[data-guide-progress]");
    const title = modal.querySelector("[data-guide-title]");
    const copy = modal.querySelector("[data-guide-copy]");
    const back = modal.querySelector("[data-guide-back]");
    const next = modal.querySelector("[data-guide-next]");

    function renderStep() {
      const [heading, body] = guide.steps[stepIndex];
      progress.textContent = `${stepIndex + 1} of ${guide.steps.length}`;
      title.textContent = heading;
      copy.textContent = body;
      back.disabled = stepIndex === 0;
      next.textContent = stepIndex === guide.steps.length - 1 ? "Finish" : "Next";
    }

    function closeGuide() {
      if (!activeGuide) return;
      completeGuide(localStorage, kind);
      document.removeEventListener("keydown", handleKeydown);
      modal.remove();
      document.body.classList.remove("tool-guide-open");
      activeGuide = null;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGuide();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...card.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-guide-close], [data-guide-skip]")) return closeGuide();
      if (event.target.closest("[data-guide-back]") && stepIndex > 0) {
        stepIndex -= 1;
        renderStep();
      }
      if (event.target.closest("[data-guide-next]")) {
        if (stepIndex === guide.steps.length - 1) return closeGuide();
        stepIndex += 1;
        renderStep();
      }
    });

    activeGuide = { kind, modal };
    document.body.appendChild(modal);
    document.body.classList.add("tool-guide-open");
    document.addEventListener("keydown", handleKeydown);
    renderStep();
    card.focus();
    return true;
  }

  function initializeGuides() {
    const kind = document.body.classList.contains("grimoire-page-shell")
      ? "grimoire"
      : document.body.classList.contains("altar-page")
        ? "altar"
        : null;
    if (!kind) return;

    document.addEventListener("click", (event) => {
      const button = event.target.closest(`[data-tool-guide="${kind}"]`);
      if (button) openGuide(kind, { manual: true, opener: button });
    });

    function openAutomaticGuideWhenReady() {
      if (document.body.classList.contains("sanctuary-modal-open")) {
        window.setTimeout(openAutomaticGuideWhenReady, 400);
        return;
      }
      openGuide(kind);
    }

    window.setTimeout(openAutomaticGuideWhenReady, 500);
  }

  const api = {
    DAILY_REFLECTION_KEY,
    DESTINATION_KEY,
    GUIDE_VERSION,
    GUIDE_KEYS,
    REFLECTIONS,
    getLocalDateKey,
    selectDailyReflection,
    normalizeDestination,
    rememberDestination,
    consumeDestination,
    isGuideComplete,
    completeGuide,
    renderDailyThresholdReflection,
    openGuide
  };

  global.WelcomeDiscovery = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      renderDailyThresholdReflection();
      initializeGuides();
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
