const altarStage = document.querySelector("[data-altar-stage]");
const altarTools = document.querySelectorAll(".altar-item[data-object]");
const emptyMessage = document.querySelector("[data-empty-message]");

let activeObject = null;
let offsetX = 0;
let offsetY = 0;

function updateEmptyMessage() {
  if (!altarStage || !emptyMessage) return;
  emptyMessage.hidden = altarStage.querySelectorAll(".altar-object").length > 0;
}

function makeDraggable(object) {
  object.addEventListener("pointerdown", (event) => {
    activeObject = object;

    const objectRect = object.getBoundingClientRect();

    offsetX = event.clientX - objectRect.left;
    offsetY = event.clientY - objectRect.top;

    object.setPointerCapture(event.pointerId);
    object.classList.add("is-dragging");
  });

  object.addEventListener("pointermove", (event) => {
    if (activeObject !== object) return;

    const stageRect = altarStage.getBoundingClientRect();

    let x = event.clientX - stageRect.left - offsetX;
    let y = event.clientY - stageRect.top - offsetY;

    const maxX = altarStage.clientWidth - object.offsetWidth;
    const maxY = altarStage.clientHeight - object.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    object.style.left = `${x}px`;
    object.style.top = `${y}px`;
  });

  object.addEventListener("pointerup", () => {
    object.classList.remove("is-dragging");
    activeObject = null;
  });
}

function placeObject(symbol, label) {
  if (!altarStage) return;

  const object = document.createElement("button");
  object.type = "button";
  object.className = "altar-object";
  
  const img = document.createElement("img");
  img.src = button.dataset.image;
  img.alt = label;
  img.draggable = false;
  
  object.appendChild(img);
  
  object.setAttribute(
    "aria-label",
    `${label}. Drag to move. Double click to remove.`
  );

  const existingObjects = altarStage.querySelectorAll(".altar-object").length;
  const row = Math.floor(existingObjects / 5);
  const column = existingObjects % 5;

  object.style.left = `${120 + column * 80}px`;
  object.style.top = `${280 + row * 70}px`;

  object.addEventListener("dblclick", () => {
    object.remove();
    updateEmptyMessage();
  });

  makeDraggable(object);

  altarStage.appendChild(object);
  updateEmptyMessage();
}

altarTools.forEach((tool) => {
  tool.addEventListener("click", () => {
    const symbol = tool.dataset.object;
    const label = tool.dataset.label || "object";

    placeObject(symbol, label);
  });
});

updateEmptyMessage();
