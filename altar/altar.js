const altarStage = document.querySelector("[data-altar-stage]");
const altarTools = document.querySelectorAll(".altar-item");
const emptyMessage = document.querySelector("[data-empty-message]");

let activeObject = null;
let selectedObject = null;
let offsetX = 0;
let offsetY = 0;
let highestLayer = 10;

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
`;

if (altarStage) {
  altarStage.appendChild(toolbar);
}

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
}

function deselectObject() {
  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = null;
  toolbar.hidden = true;
}

function keepObjectInsideStage(object) {
  if (!altarStage || !object) return;

  if (object.dataset.type === "cloth") {
    return;
  }

  const scale = Number(object.dataset.scale || 1);
  const baseWidth = object.offsetWidth;
  const baseHeight = object.offsetHeight;

  const visualWidth = baseWidth * scale;
  const visualHeight = baseHeight * scale;

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

function updateFlamePersonality(object) {
  if (!object || object.dataset.type !== "candle" || object.dataset.lit !== "true") return;

  object.style.setProperty("--flame-top-width", `${7 + Math.random() * 3}%`);
  object.style.setProperty("--flame-top-height", `${13 + Math.random() * 5}%`);
  object.style.setProperty("--flame-drift", `${0.4 + Math.random() * 1.8}px`);

  object.style.setProperty("--flame-scale-x-a", `${0.88 + Math.random() * 0.14}`);
  object.style.setProperty("--flame-scale-y-a", `${1.0 + Math.random() * 0.1}`);
  object.style.setProperty("--flame-skew-a", `${-3 + Math.random() * 2}deg`);
  object.style.setProperty("--flame-rotate-a", `${-2 + Math.random() * 1.5}deg`);

  object.style.setProperty("--flame-scale-x-b", `${0.96 + Math.random() * 0.16}`);
  object.style.setProperty("--flame-scale-y-b", `${0.93 + Math.random() * 0.12}`);
  object.style.setProperty("--flame-skew-b", `${1 + Math.random() * 3}deg`);
  object.style.setProperty("--flame-rotate-b", `${0.5 + Math.random() * 2}deg`);

  object.style.setProperty("--flame-scale-x-c", `${0.9 + Math.random() * 0.14}`);
  object.style.setProperty("--flame-scale-y-c", `${1.05 + Math.random() * 0.18}`);
  object.style.setProperty("--flame-skew-c", `${-2 + Math.random() * 2.5}deg`);
  object.style.setProperty("--flame-rotate-c", `${-1.5 + Math.random() * 1.8}deg`);

  object.style.setProperty("--flame-scale-x-d", `${0.9 + Math.random() * 0.16}`);
  object.style.setProperty("--flame-scale-y-d", `${1.0 + Math.random() * 0.16}`);
  object.style.setProperty("--flame-skew-d", `${-1 + Math.random() * 3}deg`);
  object.style.setProperty("--flame-rotate-d", `${-0.5 + Math.random() * 1.8}deg`);
}

function startFlame(object) {
  if (!object || object.dataset.type !== "candle") return;

  stopFlame(object);

  const flickerSpeed = 1.15 + Math.random() * 1.1;
  const glowSpeed = 3.0 + Math.random() * 2.2;
  const delay = Math.random() * -2;

  object.style.setProperty("--flame-flicker-speed", `${flickerSpeed}s`);
  object.style.setProperty("--flame-glow-speed", `${glowSpeed}s`);
  object.style.setProperty("--flame-delay", `${delay}s`);

  updateFlamePersonality(object);

  object.flamePersonalityTimer = window.setInterval(() => {
    updateFlamePersonality(object);
  }, 2600 + Math.random() * 1800);
}

function stopFlame(object) {
  if (!object) return;

  if (object.flamePersonalityTimer) {
    window.clearInterval(object.flamePersonalityTimer);
    object.flamePersonalityTimer = null;
  }

  const flameProperties = [
    "--flame-flicker-speed",
    "--flame-glow-speed",
    "--flame-delay",
    "--flame-top-width",
    "--flame-top-height",
    "--flame-drift",
    "--flame-scale-x-a",
    "--flame-scale-y-a",
    "--flame-skew-a",
    "--flame-rotate-a",
    "--flame-scale-x-b",
    "--flame-scale-y-b",
    "--flame-skew-b",
    "--flame-rotate-b",
    "--flame-scale-x-c",
    "--flame-scale-y-c",
    "--flame-skew-c",
    "--flame-rotate-c",
    "--flame-scale-x-d",
    "--flame-scale-y-d",
    "--flame-skew-d",
    "--flame-rotate-d"
  ];

  flameProperties.forEach((property) => {
    object.style.removeProperty(property);
  });
}

function toggleLight(object) {
  if (!object) return;

  object.dataset.lit = object.dataset.lit === "true" ? "false" : "true";
  object.classList.toggle("is-lit", object.dataset.lit === "true");

  if (object.dataset.lit === "true") {
    startFlame(object);
  } else {
    stopFlame(object);
  }
}

function deleteObject(object) {
  if (!object) return;

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

  object.type = "button";
  object.className = "altar-object";

  object.dataset.label = label || "object";
  object.dataset.type = type || "";
  object.dataset.herb = herb || "";
  object.dataset.form = form || "";
  object.dataset.color = color || "";
  object.dataset.scale = type === "cloth" ? "3" : "1";
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

document.addEventListener("pointerdown", (event) => {
  if (!altarStage) return;

  const clickedObject = event.target.closest(".altar-object");
  const clickedToolbar = event.target.closest(".altar-toolbar");

  if (!clickedObject && !clickedToolbar) {
    deselectObject();
  }
});

window.addEventListener("resize", () => {
  if (selectedObject) {
    keepObjectInsideStage(selectedObject);
  }
});

updateEmptyMessage();
