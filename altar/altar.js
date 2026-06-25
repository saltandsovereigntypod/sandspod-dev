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
  positionToolbar();
}

function deselectObject() {
  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = null;
  toolbar.hidden = true;
}

function positionToolbar() {
  if (!selectedObject || !altarStage || toolbar.hidden) return;

  const stageRect = altarStage.getBoundingClientRect();
  const objectRect = selectedObject.getBoundingClientRect();

  const toolbarWidth = toolbar.offsetWidth || 260;
  const toolbarHeight = toolbar.offsetHeight || 44;

  let left = objectRect.left - stageRect.left + objectRect.width / 2 - toolbarWidth / 2;
  let top = objectRect.top - stageRect.top - toolbarHeight - 10;

  left = Math.max(8, Math.min(left, altarStage.clientWidth - toolbarWidth - 8));

  if (top < 8) {
    top = objectRect.bottom - stageRect.top + 10;
  }

  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;
}

function keepObjectInsideStage(object) {
  if (!altarStage || !object) return;

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
  let scale = Number(object.dataset.scale || 1);
  scale += amount;
  scale = Math.max(0.35, Math.min(scale, 3));

  object.dataset.scale = String(scale);
  updateObjectTransform(object);
  keepObjectInsideStage(object);
  positionToolbar();
}

function rotateObject(object) {
  let rotation = Number(object.dataset.rotation || 0);
  rotation += 15;

  object.dataset.rotation = String(rotation);
  updateObjectTransform(object);
  positionToolbar();
}

function bringForward(object) {
  highestLayer += 1;
  object.style.zIndex = highestLayer;
  positionToolbar();
}

function sendBackward(object) {
  let currentLayer = Number(object.style.zIndex || 10);
  currentLayer = Math.max(5, currentLayer - 1);

  object.style.zIndex = currentLayer;
  positionToolbar();
}

function flipObject(object) {
  object.dataset.flipped = object.dataset.flipped === "true" ? "false" : "true";
  updateObjectTransform(object);
  positionToolbar();
}

function toggleLock(object) {
  const isLocked = object.dataset.locked === "true";
  object.dataset.locked = isLocked ? "false" : "true";
  object.classList.toggle("is-locked", !isLocked);
  positionToolbar();
}

function toggleGlow(object) {
  object.dataset.glowing = object.dataset.glowing === "true" ? "false" : "true";
  object.classList.toggle("has-glow", object.dataset.glowing === "true");
}

function toggleLight(object) {
  object.dataset.lit = object.dataset.lit === "true" ? "false" : "true";
  object.classList.toggle("is-lit", object.dataset.lit === "true");
}

function deleteObject(object) {
  object.remove();
  deselectObject();
  updateEmptyMessage();
}

function duplicateObject(object) {
  const clone = object.cloneNode(true);

  highestLayer += 1;

  clone.style.left = `${(parseFloat(object.style.left) || 0) + 24}px`;
  clone.style.top = `${(parseFloat(object.style.top) || 0) + 24}px`;
  clone.style.zIndex = highestLayer;

  clone.classList.remove("is-selected", "is-dragging");
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

    const maxX = altarStage.clientWidth - object.offsetWidth * scale;
    const maxY = altarStage.clientHeight - object.offsetHeight * scale;

    x = Math.max(0, Math.min(x, Math.max(0, maxX)));
    y = Math.max(0, Math.min(y, Math.max(0, maxY)));

    object.style.left = `${x}px`;
    object.style.top = `${y}px`;

    positionToolbar();
  });

  object.addEventListener("pointerup", () => {
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

function placeObject(imagePath, fallbackSymbol, label) {
  if (!altarStage) return;

  const object = document.createElement("button");
  object.type = "button";
  object.className = "altar-object";

  object.dataset.label = label;
  object.dataset.scale = "1";
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
    img.alt = label;
    img.draggable = false;

    object.appendChild(img);
  } else {
    object.textContent = fallbackSymbol;
  }

  object.setAttribute(
    "aria-label",
    `${label}. Click to select. Drag to move. Double click to remove.`
  );

  const existingObjects = altarStage.querySelectorAll(".altar-object").length;
  const row = Math.floor(existingObjects / 5);
  const column = existingObjects % 5;

  object.style.left = `${120 + column * 80}px`;
  object.style.top = `${280 + row * 70}px`;

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
    const imagePath = tool.dataset.image;
    const fallbackSymbol = tool.dataset.object || "";
    const label = tool.dataset.label || "object";

    placeObject(imagePath, fallbackSymbol, label);
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
    positionToolbar();
  }
});

updateEmptyMessage();
