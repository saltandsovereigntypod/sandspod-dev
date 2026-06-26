const altarStage = document.querySelector("[data-altar-stage]");
const altarTools = document.querySelectorAll(".altar-item");
const emptyMessage = document.querySelector("[data-empty-message]");

let activeObject = null;
let selectedObject = null;
let offsetX = 0;
let offsetY = 0;
let highestLayer = 10;
let pendingCandleDressing = null;

const toolbar = document.createElement("div");
toolbar.className = "altar-toolbar";
toolbar.hidden = true;
toolbar.innerHTML = `
  <button type="button" data-action="smaller" title="Make smaller">−</button>
  <button type="button" data-action="larger" title="Make larger">+</button>
  <button type="button" data-action="rotate" title="Rotate">↻</button>
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

const altarGlobalControls = document.createElement("div");
altarGlobalControls.className = "altar-global-controls";
altarGlobalControls.innerHTML = `
  <button
    type="button"
    class="altar-global-toggle"
    data-global-toggle
    aria-label="Open altar controls"
    aria-expanded="false">
    <span></span>
    <span></span>
    <span></span>
  </button>

  <div class="altar-global-menu" data-global-menu hidden>
    <button type="button" data-global-action="light-all">🔥 All</button>
    <button type="button" data-global-action="extinguish-all">💨 All</button>
  </div>
`;

if (altarStage) {
  altarStage.appendChild(toolbar);
  altarStage.appendChild(altarGlobalControls);
}

const globalToggle = altarGlobalControls.querySelector("[data-global-toggle]");
const globalMenu = altarGlobalControls.querySelector("[data-global-menu]");

function updateEmptyMessage() {
  if (!altarStage || !emptyMessage) return;
  emptyMessage.hidden = altarStage.querySelectorAll(".altar-object").length > 0;
}

function updateObjectTransform(object) {
  const scale = Number(object.dataset.scale || 1);
  const rotation = Number(object.dataset.rotation || 0);
  const flipped = object.dataset.flipped === "true" ? -1 : 1;

  object.style.transform = `scaleX(${flipped}) scale(${scale}) rotate(${rotation}deg)`;
}

function selectObject(object) {
  if (!object) return;

  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = object;
  selectedObject.classList.add("is-selected");
  toolbar.hidden = false;
  updateToolbarNotes(selectedObject);
}

function deselectObject() {
  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = null;
  toolbar.hidden = true;
  updateToolbarNotes(null);
}

function keepObjectInsideStage(object) {
  if (!altarStage || !object) return;

  if (object.dataset.type === "cloth") return;

  const scale = Number(object.dataset.scale || 1);
  const visualWidth = object.offsetWidth * scale;
  const visualHeight = object.offsetHeight * scale;

  let x = parseFloat(object.style.left) || 0;
  let y = parseFloat(object.style.top) || 0;

  const maxX = altarStage.clientWidth - visualWidth;
  const maxY = altarStage.clientHeight - visualHeight;

  x = Math.max(0, Math.min(x, Math.max(0, maxX)));
  y = Math.max(0, Math.min(y, Math.max(0, maxY)));

  object.style.left = `${x}px`;
  object.style.top = `${y}px`;
}

function resizeObject(object, amount) {
  if (!object || object.dataset.locked === "true") return;

  let scale = Number(object.dataset.scale || 1);
  scale += amount;

  const maxScale = object.dataset.type === "cloth" ? 18 : 3;
  scale = Math.max(0.35, Math.min(scale, maxScale));

  object.dataset.scale = String(scale);

  updateObjectTransform(object);
  keepObjectInsideStage(object);
}

function rotateObject(object) {
  if (!object || object.dataset.locked === "true") return;

  let rotation = Number(object.dataset.rotation || 0);
  rotation += 15;

  object.dataset.rotation = String(rotation);
  updateObjectTransform(object);
}

function bringForward(object) {
  if (!object) return;

  highestLayer += 1;
  object.style.zIndex = highestLayer;
}

function sendBackward(object) {
  if (!object) return;

  let currentLayer = Number(object.style.zIndex || 10);
  currentLayer = Math.max(5, currentLayer - 1);

  object.style.zIndex = currentLayer;
}

function flipObject(object) {
  if (!object || object.dataset.locked === "true") return;

  object.dataset.flipped = object.dataset.flipped === "true" ? "false" : "true";
  updateObjectTransform(object);
}

function toggleLock(object) {
  if (!object) return;

  const isLocked = object.dataset.locked === "true";

  object.dataset.locked = isLocked ? "false" : "true";
  object.classList.toggle("is-locked", !isLocked);
}

function toggleGlow(object) {
  if (!object) return;

  object.dataset.glowing = object.dataset.glowing === "true" ? "false" : "true";
  object.classList.toggle("has-glow", object.dataset.glowing === "true");
}

function canDressCandle(object) {
  if (!object) return false;

  const isOil = object.dataset.type === "oil";
  const isDressableHerb =
    object.dataset.type === "herb" &&
    (object.dataset.form === "loose" || object.dataset.form === "powder");

  return isOil || isDressableHerb;
}

function getDressings(candle) {
  if (!candle || !candle.dataset.dressings) return [];

  try {
    return JSON.parse(candle.dataset.dressings);
  } catch {
    return [];
  }
}

function formatDressingName(dressing) {
  const herb = dressing.herb || "Unknown";
  const form = dressing.form || "";

  const prettyHerb = herb.charAt(0).toUpperCase() + herb.slice(1);
  const prettyForm = form.charAt(0).toUpperCase() + form.slice(1);

  return `${prettyHerb} ${prettyForm}`.trim();
}

function updateDressingRecord(candle) {
  if (!candle || candle.dataset.type !== "candle") return;

  const oldRecord = candle.querySelector(".candle-dressing-record");
  if (oldRecord) oldRecord.remove();

  const dressings = getDressings(candle);
  if (dressings.length === 0) return;

  const record = document.createElement("span");
  record.className = "candle-dressing-record";
  record.textContent = `Dressed with: ${dressings.map(formatDressingName).join(", ")}`;

  candle.appendChild(record);
}

function addCandleDressingVisual(candle, dressing) {
  if (!candle || candle.dataset.type !== "candle") return;

  if (dressing.type === "oil") {
    if (!candle.querySelector(".candle-dressing-sheen")) {
      const sheen = document.createElement("span");
      sheen.className = "candle-dressing-sheen";
      candle.appendChild(sheen);
    }
  }

  if (dressing.type === "herb") {
    if (!candle.querySelector(".candle-dressing-flecks")) {
      const flecks = document.createElement("span");
      flecks.className = "candle-dressing-flecks";
      candle.appendChild(flecks);
    }
  }
}

function dressCandle(candle, ingredient) {
  if (!candle || candle.dataset.type !== "candle" || !ingredient) return;

  const dressing = {
    type: ingredient.dataset.type || "",
    herb: ingredient.dataset.herb || "",
    form: ingredient.dataset.form || "",
    label: ingredient.dataset.label || ""
  };

  const dressings = getDressings(candle);
  dressings.push(dressing);

  candle.dataset.dressings = JSON.stringify(dressings);
  candle.classList.add("is-dressed");

  addCandleDressingVisual(candle, dressing);
  updateDressingRecord(candle);
}

function beginCandleDressing(object) {
  if (!canDressCandle(object)) return;

  pendingCandleDressing = object;
  altarStage.classList.add("is-dressing-candle");

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

  altarStage
    .querySelectorAll(".can-receive-dressing")
    .forEach((object) => {
      object.classList.remove("can-receive-dressing");
    });
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
  if (!object) return;

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

function deleteObject(object) {
  if (!object) return;

  if (object === selectedObject) {
  cancelCandleDressing();
}

  stopFlame(object);
  object.remove();
  deselectObject();
  updateEmptyMessage();
}

function duplicateObject(object) {
  if (!object) return;

  const clone = object.cloneNode(true);

  highestLayer += 1;

  clone.style.left = `${(parseFloat(object.style.left) || 0) + 24}px`;
  clone.style.top = `${(parseFloat(object.style.top) || 0) + 24}px`;
  clone.style.zIndex = highestLayer;

  clone.classList.remove("is-selected", "is-dragging");
  updateCandleDressingVisuals(clone);

  if (clone.dataset.lit === "true") {
    startFlame(clone);
  }

  makeDraggable(clone);

  altarStage.appendChild(clone);
  selectObject(clone);
  updateEmptyMessage();
}

function makeDraggable(object) {
  object.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".altar-toolbar")) return;

    if (pendingCandleDressing && object.dataset.type === "candle") {
      dressCandle(object);
      return;
    }
    
    selectObject(object);
    
    if (object.dataset.locked === "true") return;

    activeObject = object;

    const objectRect = object.getBoundingClientRect();

    offsetX = event.clientX - objectRect.left;
    offsetY = event.clientY - objectRect.top;

    object.setPointerCapture(event.pointerId);
    object.classList.add("is-dragging");
  });

  object.addEventListener("pointermove", (event) => {
    if (activeObject !== object || object.dataset.locked === "true") return;

    const stageRect = altarStage.getBoundingClientRect();
    const scale = Number(object.dataset.scale || 1);

    let x = event.clientX - stageRect.left - offsetX;
    let y = event.clientY - stageRect.top - offsetY;

    if (object.dataset.type === "cloth") {
      const visualWidth = object.offsetWidth * scale;
      const visualHeight = object.offsetHeight * scale;

      const minX = -visualWidth * 0.75;
      const minY = -visualHeight * 0.75;
      const maxX = altarStage.clientWidth - visualWidth * 0.25;
      const maxY = altarStage.clientHeight - visualHeight * 0.25;

      x = Math.max(minX, Math.min(x, maxX));
      y = Math.max(minY, Math.min(y, maxY));
    } else {
      const maxX = altarStage.clientWidth - object.offsetWidth * scale;
      const maxY = altarStage.clientHeight - object.offsetHeight * scale;

      x = Math.max(0, Math.min(x, Math.max(0, maxX)));
      y = Math.max(0, Math.min(y, Math.max(0, maxY)));
    }

    object.style.left = `${x}px`;
    object.style.top = `${y}px`;
  });

  object.addEventListener("pointerup", () => {
    object.classList.remove("is-dragging");
    activeObject = null;
  });

  object.addEventListener("pointercancel", () => {
    object.classList.remove("is-dragging");
    activeObject = null;
  });

  object.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (object.dataset.locked === "true") return;

    selectObject(object);
    resizeObject(object, event.deltaY < 0 ? 0.1 : -0.1);
  });

  object.addEventListener("dblclick", () => {
    deleteObject(object);
  });
}

function placeObject(options) {
  if (!altarStage) return;

  const {
    imagePath,
    fallbackSymbol,
    label,
    type,
    herb,
    form,
    color
  } = options;

  const object = document.createElement("button");
  const isMobile = window.innerWidth <= 768;

  object.type = "button";
  object.className = "altar-object";

  object.dataset.label = label || "object";
  object.dataset.type = type || "";
  object.dataset.herb = herb || "";
  object.dataset.form = form || "";
  object.dataset.color = color || "";
  object.dataset.scale =
    type === "cloth"
      ? "3"
      : isMobile
        ? "1.8"
        : "1";
  object.dataset.rotation = "0";
  object.dataset.flipped = "false";
  object.dataset.locked = "false";
  object.dataset.glowing = "false";
  object.dataset.lit = "false";

  highestLayer += 1;
  object.style.zIndex = highestLayer;

  if (imagePath) {
    const img = document.createElement("img");

    img.src = imagePath;
    img.alt = label || "altar object";
    img.draggable = false;

    object.appendChild(img);
  } else {
    object.textContent = fallbackSymbol || "";
  }

  object.setAttribute(
    "aria-label",
    `${label || "Object"}. Click to select. Drag to move. Double click to remove.`
  );

  const existingObjects = altarStage.querySelectorAll(".altar-object").length;
  const row = Math.floor(existingObjects / 5);
  const column = existingObjects % 5;

  object.style.left = `${120 + column * 80}px`;
  object.style.top = `${280 + row * 70}px`;

  updateObjectTransform(object);
  makeDraggable(object);

  altarStage.appendChild(object);
  selectObject(object);
  updateEmptyMessage();
}

toolbar.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button || !selectedObject) return;

  const action = button.dataset.action;

  if (action === "smaller") resizeObject(selectedObject, -0.1);
  if (action === "larger") resizeObject(selectedObject, 0.1);
  if (action === "rotate") rotateObject(selectedObject);
  if (action === "delete") deleteObject(selectedObject);
  if (action === "forward") bringForward(selectedObject);
  if (action === "backward") sendBackward(selectedObject);
  if (action === "flip") flipObject(selectedObject);
  if (action === "lock") toggleLock(selectedObject);
  if (action === "duplicate") duplicateObject(selectedObject);
  if (action === "glow") toggleGlow(selectedObject);
  if (action === "light") toggleLight(selectedObject);
  if (action === "dress-candle") beginCandleDressing(selectedObject);
});

altarTools.forEach((tool) => {
  tool.addEventListener("click", () => {
    placeObject({
      imagePath: tool.dataset.image || "",
      fallbackSymbol: tool.dataset.object || "",
      label: tool.dataset.label || "object",
      type: tool.dataset.type || "",
      herb: tool.dataset.herb || "",
      form: tool.dataset.form || "",
      color: tool.dataset.color || ""
    });
  });
});

globalToggle.addEventListener("click", (event) => {
  event.stopPropagation();

  const isOpen = !globalMenu.hidden;

  globalMenu.hidden = isOpen;
  globalToggle.setAttribute("aria-expanded", String(!isOpen));
  altarGlobalControls.classList.toggle("is-open", !isOpen);
});

altarGlobalControls.addEventListener("click", (event) => {
  const button = event.target.closest("[data-global-action]");
  if (!button) return;

  const action = button.dataset.globalAction;
  const candles = altarStage.querySelectorAll('.altar-object[data-type="candle"]');

  candles.forEach((candle) => {
    if (action === "light-all" && candle.dataset.lit !== "true") {
      candle.dataset.lit = "true";
      candle.classList.add("is-lit");
      startFlame(candle);
    }

    if (action === "extinguish-all" && candle.dataset.lit === "true") {
      candle.dataset.lit = "false";
      candle.classList.remove("is-lit");
      stopFlame(candle);
      extinguishFlame(candle);
    }
  });
});

document.addEventListener("pointerdown", (event) => {
  if (!altarStage) return;

  const clickedObject = event.target.closest(".altar-object");
  const clickedToolbar = event.target.closest(".altar-toolbar");
  const clickedGlobalControls = event.target.closest(".altar-global-controls");

  if (!clickedObject && !clickedToolbar) {
    deselectObject();
  }

  if (!clickedGlobalControls && globalMenu) {
    globalMenu.hidden = true;
    globalToggle.setAttribute("aria-expanded", "false");
    altarGlobalControls.classList.remove("is-open");
  }
});

window.addEventListener("resize", () => {
  if (selectedObject) {
    keepObjectInsideStage(selectedObject);
  }
});

updateEmptyMessage();
