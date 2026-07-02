/* =========================================================
   ALTAR OBJECTS
   Object transforms, placement, dragging, duplication, delete
   ========================================================= */

function updateObjectTransform(object) {
  const scale = Number(object.dataset.scale || 1);
  const rotation = Number(object.dataset.rotation || 0);
  const flipped = object.dataset.flipped === "true" ? -1 : 1;

  object.style.transform = `scaleX(${flipped}) scale(${scale}) rotate(${rotation}deg)`;
}

function getObjectImagePath(object) {
  const img = object.querySelector(
    "img:not(.candle-herb-overlay):not(.candle-oil-overlay)"
  );

  return img ? img.getAttribute("src") : "";
}

const altarUndoStack = [];
const altarRedoStack = [];
let dragStartSnapshot = null;

function captureAltarSnapshot() {
  if (!altarStage) return null;

  const objects = Array.from(altarStage.querySelectorAll(".altar-object")).map((object) => {
    const position = getStagePositionPercent(object);

    return {
      imagePath: getObjectImagePath(object),
      fallbackSymbol: object.textContent || "",
      label: object.dataset.label || "object",
      type: object.dataset.type || "",
      herb: object.dataset.herb || "",
      form: object.dataset.form || "",
      color: object.dataset.color || "",
      crystal: object.dataset.crystal || "",
      tool: object.dataset.tool || "",
      vessel: object.dataset.vessel || "",
      deity: object.dataset.deity || "",
      scale: object.dataset.scale || "1",
      rotation: object.dataset.rotation || "0",
      flipped: object.dataset.flipped || "false",
      locked: object.dataset.locked || "false",
      glowing: object.dataset.glowing || "false",
      lit: object.dataset.lit || "false",
      dressings: object.dataset.dressings || "[]",
      plaqueText: object.dataset.plaqueText || "",
      altarObjectId: object.dataset.altarObjectId || "",
      groupId: object.dataset.groupId || "",
      leftPercent: position.leftPercent,
      topPercent: position.topPercent,
      sizePercent: position.sizePercent,
      zIndex: object.style.zIndex || "10"
    };
  });

  return {
    background: altarStage.dataset.background || "",
    backgroundName: altarStage.dataset.backgroundName || "",
    groups: Array.isArray(altarGroups) ? JSON.parse(JSON.stringify(altarGroups)) : [],
    activeGroupId,
    objects
  };
}

function pushAltarUndoSnapshot(snapshot = captureAltarSnapshot()) {
  if (!snapshot) return;

  altarUndoStack.push(snapshot);

  if (altarUndoStack.length > 60) {
    altarUndoStack.shift();
  }

  altarRedoStack.length = 0;
}

function restoreAltarSnapshot(snapshot) {
  if (!snapshot || !altarStage) return;

  altarStage.querySelectorAll(".altar-object").forEach((object) => {
    stopFlame(object);
    object.remove();
  });

  deselectObject();
  clearCandleDressingMode();

  if (snapshot.background) {
    altarStage.style.backgroundImage = `url("${snapshot.background}")`;
    altarStage.dataset.background = snapshot.background;
    altarStage.dataset.backgroundName = snapshot.backgroundName || "";
  }

  altarGroups = Array.isArray(snapshot.groups) ? JSON.parse(JSON.stringify(snapshot.groups)) : [];
  activeGroupId = snapshot.activeGroupId || null;

  highestLayer = 10;

  (snapshot.objects || []).forEach((savedObject) => {
    const object = createSavedObject(savedObject);
    altarStage.appendChild(object);

    highestLayer = Math.max(highestLayer, Number(savedObject.zIndex || 10));

    const img = object.querySelector("img");

    function positionRestoredObject() {
      applyStagePositionPercent(object, savedObject);
      updateObjectTransform(object);
      keepObjectInsideStage(object);
      updateObjectPositionPercent(object);
    }

    if (img && !img.complete) {
      img.addEventListener("load", positionRestoredObject, { once: true });
    } else {
      positionRestoredObject();
    }
  });

  updateGroupIndicator();
  syncGroupObjectClasses();
  updateEmptyMessage();
}

function undoAltarChange() {
  if (altarUndoStack.length === 0) {
    showAltarToast("Nothing to undo");
    return;
  }

  const currentSnapshot = captureAltarSnapshot();
  const previousSnapshot = altarUndoStack.pop();

  if (currentSnapshot) {
    altarRedoStack.push(currentSnapshot);
  }

  restoreAltarSnapshot(previousSnapshot);
  showAltarToast("Undone");
}

function redoAltarChange() {
  if (altarRedoStack.length === 0) {
    showAltarToast("Nothing to redo");
    return;
  }

  const currentSnapshot = captureAltarSnapshot();
  const nextSnapshot = altarRedoStack.pop();

  if (currentSnapshot) {
    altarUndoStack.push(currentSnapshot);
  }

  restoreAltarSnapshot(nextSnapshot);
  showAltarToast("Redone");
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

  const objectsToResize = object.dataset.groupId
    ? getGroupObjects(object.dataset.groupId)
    : [object];

  objectsToResize.forEach((item) => {
    if (item.dataset.locked === "true") return;

    const oldScale = Number(item.dataset.scale || 1);
    const oldLeft = parseFloat(item.style.left) || 0;
    const oldTop = parseFloat(item.style.top) || 0;

    const centerX = oldLeft + (item.offsetWidth * oldScale) / 2;
    const centerY = oldTop + (item.offsetHeight * oldScale) / 2;

    let newScale = oldScale + amount;
    const maxScale = item.dataset.type === "cloth" ? 18 : 3;
    const minScale = item.dataset.type === "candle" ? 0.18 : 0.35;

    newScale = Math.max(minScale, Math.min(newScale, maxScale));

    item.dataset.scale = String(newScale);
    updateObjectTransform(item);

    item.style.left = `${centerX - (item.offsetWidth * newScale) / 2}px`;
    item.style.top = `${centerY - (item.offsetHeight * newScale) / 2}px`;

    keepObjectInsideStage(item);
    updateObjectPositionPercent(item);
  });
}

function rotateObject(object, amount = 15) {
  if (!object || object.dataset.locked === "true") return;

  const rotation = Number(object.dataset.rotation || 0) + amount;

  object.dataset.rotation = String(rotation);
  updateObjectTransform(object);
  updateObjectPositionPercent(object);
}

function bringForward(object) {
  if (!object) return;

  highestLayer += 1;
  object.style.zIndex = highestLayer;
}

function sendBackward(object) {
  if (!object) return;

  const currentLayer = Number(object.style.zIndex || 10);
  object.style.zIndex = Math.max(5, currentLayer - 1);
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

function makeDraggable(object) {
  object.addEventListener("pointerenter", () => {
    showAltarInfoCard(object);
  });

  object.addEventListener("pointerleave", () => {
    if (selectedObject !== object) {
      hideAltarInfoCard();
    }
  });

  object.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".altar-toolbar")) return;

    if (pendingCandleDressing && object.dataset.type === "candle") {
      dressCandle(object);
      return;
    }

    if (altarSelectionMode) {
      toggleRitualItem(object);
      return;
    }

    selectObject(object);

    if (object.dataset.locked === "true") return;

    dragStartSnapshot = captureAltarSnapshot();
     
    activeObject = object;

    const stageRect = altarStage.getBoundingClientRect();

    offsetX = event.clientX - stageRect.left - (parseFloat(object.style.left) || 0);
    offsetY = event.clientY - stageRect.top - (parseFloat(object.style.top) || 0);

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

    const oldX = parseFloat(object.style.left) || 0;
    const oldY = parseFloat(object.style.top) || 0;
    const deltaX = x - oldX;
    const deltaY = y - oldY;

    object.style.left = `${x}px`;
    object.style.top = `${y}px`;

    updateObjectPositionPercent(object);

    if (object.dataset.groupId) {
      const groupObjects = getGroupObjects(object.dataset.groupId);

      groupObjects.forEach((groupObject) => {
        if (groupObject === object) return;

        const groupX = parseFloat(groupObject.style.left) || 0;
        const groupY = parseFloat(groupObject.style.top) || 0;

        groupObject.style.left = `${groupX + deltaX}px`;
        groupObject.style.top = `${groupY + deltaY}px`;

        updateObjectPositionPercent(groupObject);
        keepObjectInsideStage(groupObject);
      });
    }
  });

  object.addEventListener("pointerup", () => {
    object.classList.remove("is-dragging");
     if (dragStartSnapshot) {
        pushAltarUndoSnapshot(dragStartSnapshot);
        dragStartSnapshot = null;
      }
    activeObject = null;
  });

  object.addEventListener("pointercancel", () => {
    object.classList.remove("is-dragging");
     if (dragStartSnapshot) {
        pushAltarUndoSnapshot(dragStartSnapshot);
        dragStartSnapshot = null;
      }
    activeObject = null;
  });

  object.addEventListener("wheel", (event) => {
    if (selectedObject !== object) return;

    event.preventDefault();

    if (object.dataset.locked === "true") return;

     pushAltarUndoSnapshot();

    resizeObject(object, event.deltaY < 0 ? 0.1 : -0.1);
  });

  object.addEventListener("dblclick", () => {
    deleteObject(object);
  });
}

function placeObject(options) {
   pushAltarUndoSnapshot();
  if (!altarStage) return;

  const {
     imagePath,
     fallbackSymbol,
     label,
     type,
     herb,
     form,
     color,
     crystal,
     tool,
     vessel,
     deity
   } = options;
  const object = document.createElement("button");

  object.type = "button";
  object.className = "altar-object";

  object.dataset.label = label || "object";
  object.dataset.type = type || "";
  object.dataset.herb = herb || "";
  object.dataset.form = form || "";
  object.dataset.color = color || "";

  object.dataset.crystal = crystal || "";
  object.dataset.tool = tool || "";
  object.dataset.vessel = vessel || "";
  object.dataset.deity = deity || "";

  const startingScale = type === "cloth"
    ? "3"
    : String(Math.max(0.75, Math.min(1.35, altarStage.clientWidth / 900)));

  object.dataset.scale = startingScale;
  object.dataset.rotation = "0";
  object.dataset.flipped = "false";
  object.dataset.locked = "false";
  object.dataset.glowing = "false";
  object.dataset.lit = "false";
  object.dataset.dressings = "[]";

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

  altarStage.appendChild(object);

  const scale = Number(object.dataset.scale || 1);
  const centerX = altarStage.clientWidth / 2;
  const centerY = altarStage.clientHeight / 2;

  object.style.left = `${centerX - (object.offsetWidth * scale) / 2}px`;
  object.style.top = `${centerY - (object.offsetHeight * scale) / 2}px`;

  updateObjectPositionPercent(object);
  updateObjectTransform(object);
  makeDraggable(object);

  selectObject(object);
  updateEmptyMessage();
}

function deleteObject(object) {
  if (!object) return;

   pushAltarUndoSnapshot();

  if (object === selectedObject) {
    clearCandleDressingMode();
  }

  stopFlame(object);
  object.remove();
  deselectObject();
  updateEmptyMessage();
}

function duplicateObject(object) {
  if (!object || !altarStage) return;

   pushAltarUndoSnapshot();

  const clone = object.cloneNode(true);

  highestLayer += 1;

  clone.style.left = `${(parseFloat(object.style.left) || 0) + 24}px`;
  clone.style.top = `${(parseFloat(object.style.top) || 0) + 24}px`;
  clone.style.zIndex = highestLayer;

  updateObjectPositionPercent(clone);

  clone.classList.remove("is-selected", "is-dragging", "can-receive-dressing");

  updateCandleDressingVisuals(clone);

  if (clone.dataset.lit === "true") {
    startFlame(clone);
  }

  makeDraggable(clone);

  altarStage.appendChild(clone);
  selectObject(clone);
  updateEmptyMessage();
}
