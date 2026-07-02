/* =========================================================
   ALTAR CANDLES
   Candle lighting and dressing
   ========================================================= */

function getDressings(candle) {
  if (!candle || !candle.dataset.dressings) return [];

  try {
    return JSON.parse(candle.dataset.dressings);
  } catch {
    return [];
  }
}

function saveDressings(candle, dressings) {
  candle.dataset.dressings = JSON.stringify(dressings);
}

function formatDressingName(dressing) {
  const herb = dressing.herb || "Unknown";
  const form = dressing.form || "";

  const prettyHerb = herb.charAt(0).toUpperCase() + herb.slice(1);
  const prettyForm = form.charAt(0).toUpperCase() + form.slice(1);

  return `${prettyHerb} ${prettyForm}`.trim();
}

function startFlame(object) {
  if (!object || object.dataset.type !== "candle") return;

  const flickerSpeed = 1.4 + Math.random() * 0.9;
  const glowSpeed = 3.2 + Math.random() * 1.8;
  const delay = Math.random() * -2;

  object.style.setProperty("--flame-flicker-speed", `${flickerSpeed}s`);
  object.style.setProperty("--flame-glow-speed", `${glowSpeed}s`);
  object.style.setProperty("--flame-delay", `${delay}s`);
}

function stopFlame(object) {
  if (!object) return;

  object.style.removeProperty("--flame-flicker-speed");
  object.style.removeProperty("--flame-glow-speed");
  object.style.removeProperty("--flame-delay");
}

function extinguishFlame(object) {
  if (!object || object.dataset.type !== "candle") return;

  object.classList.add("is-extinguishing");

  window.setTimeout(() => {
    object.classList.remove("is-extinguishing");
  }, 1400);
}

function toggleLight(object) {
  if (!object || object.dataset.type !== "candle") return;

  const isCurrentlyLit = object.dataset.lit === "true";

  if (isCurrentlyLit) {
    object.dataset.lit = "false";
    object.classList.remove("is-lit");
    stopFlame(object);
    extinguishFlame(object);
  } else {
    object.dataset.lit = "true";
    object.classList.add("is-lit");
    startFlame(object);
  }
}

function canDressCandle(object) {
  if (!object) return false;

  const isOil = object.dataset.type === "oil";
  const isDressableHerb =
    object.dataset.type === "herb" &&
    object.dataset.form === "loose";

  return isOil || isDressableHerb;
}

function ensureCandleOverlay(candle, className, src) {
  if (!candle || candle.dataset.type !== "candle") return;

  if (candle.querySelector(`.${className}`)) return;

  const overlay = document.createElement("img");
  overlay.className = className;
  overlay.src = src;
  overlay.alt = "";
  overlay.draggable = false;
  overlay.setAttribute("aria-hidden", "true");

  candle.appendChild(overlay);
}

function removeCandleOverlay(candle, className) {
  const overlay = candle.querySelector(`.${className}`);

  if (overlay) overlay.remove();
}

function updateCandleDressingVisuals(candle) {
  if (!candle || candle.dataset.type !== "candle") return;

  const dressings = getDressings(candle);

  const hasHerbDressing = dressings.some(
    (dressing) => dressing.type === "herb" && dressing.form === "loose"
  );

  const hasOilDressing = dressings.some((dressing) => dressing.type === "oil");

  candle.classList.toggle("is-dressed", dressings.length > 0);

  if (hasHerbDressing) {
    ensureCandleOverlay(candle, "candle-herb-overlay", CANDLE_HERB_OVERLAY_SRC);
  } else {
    removeCandleOverlay(candle, "candle-herb-overlay");
  }

  if (hasOilDressing) {
    ensureCandleOverlay(candle, "candle-oil-overlay", CANDLE_OIL_OVERLAY_SRC);
  } else {
    removeCandleOverlay(candle, "candle-oil-overlay");
  }
}

function beginCandleDressing(object) {
  if (!canDressCandle(object) || !altarStage) return;

  pendingCandleDressing = {
    type: object.dataset.type || "",
    herb: object.dataset.herb || "",
    form: object.dataset.form || "",
    label: object.dataset.label || "Ingredient"
  };

  altarStage.classList.add("is-dressing-candle");
  toolbar.classList.add("is-dressing-mode");

  altarStage
    .querySelectorAll('.altar-object[data-type="candle"]')
    .forEach((candle) => {
      candle.classList.add("can-receive-dressing");
    });
}

function clearCandleDressingMode() {
  pendingCandleDressing = null;

  if (!altarStage) return;

  altarStage.classList.remove("is-dressing-candle");
  toolbar.classList.remove("is-dressing-mode");

  altarStage.querySelectorAll(".can-receive-dressing").forEach((object) => {
    object.classList.remove("can-receive-dressing");
  });
}

function dressCandle(candle) {
  if (!pendingCandleDressing || !candle || candle.dataset.type !== "candle") {
    return;
  }

  const dressings = getDressings(candle);

  const alreadyAdded = dressings.some(
    (dressing) =>
      dressing.type === pendingCandleDressing.type &&
      dressing.herb === pendingCandleDressing.herb &&
      dressing.form === pendingCandleDressing.form
  );

  if (!alreadyAdded) {
    dressings.push(pendingCandleDressing);
  }

  saveDressings(candle, dressings);
  updateCandleDressingVisuals(candle);
  selectObject(candle);
  clearCandleDressingMode();
}
