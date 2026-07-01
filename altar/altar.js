/* =========================================================
   6. GENERAL UI HELPERS
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

/* =========================================================
   7. ALTAR BACKGROUNDS
   ========================================================= */

function changeAltarBackground(button) {
  if (!altarStage || !button) return;

  const backgroundPath = button.dataset.background || "";
  const backgroundName = button.dataset.backgroundName || "Altar background";

  if (!backgroundPath) return;

  altarStage.style.backgroundImage = `url("${backgroundPath}")`;
  altarStage.dataset.background = backgroundPath;
  altarStage.dataset.backgroundName = backgroundName;

  showAltarToast(`${backgroundName} selected`);
}

/* =========================================================
   7B. CABINET DATA AND RENDERING
   ========================================================= */

const cabinetCategories = [
  { id: "backgrounds", label: "Backgrounds", icon: "🌲" },
  { id: "candles", label: "Candles", icon: "🕯️" },
  { id: "herbs", label: "Herbs", icon: "🌿" },
  { id: "crystals", label: "Crystals", icon: "💎" },
  { id: "tools", label: "Tools", icon: "🗝️" },
  { id: "deities", label: "Deities", icon: "👑" },
  { id: "vessels", label: "Vessels", icon: "🏺" }
];

const cabinetItems = [
  {
    category: "backgrounds",
    name: "Forest Altar",
    icon: "🌲",
    keywords: ["forest", "green", "crossroads"],
    background: "../assets/altar/backgrounds/forest-scene.png"
  },
  {
    category: "backgrounds",
    name: "Deity Shelf Altar",
    icon: "🕯️",
    keywords: ["shelf", "deity", "statues"],
    background: "../assets/altar/backgrounds/shelf-deity-altar.png"
  },

  ...["white", "black", "green", "purple", "red", "orange", "yellow", "blue", "brown", "pink", "gold", "silver"].map((color) => ({
    category: "candles",
    name: `${color.charAt(0).toUpperCase() + color.slice(1)} Candle`,
    icon: "🕯️",
    keywords: [color, "candle", "fire"],
    forms: [
      {
        label: "Place",
        image: `../assets/altar/objects/candles/${color}-candle.${color === "white" || color === "black" ? "PNG" : "png"}`,
        type: "candle",
        color
      }
    ]
  })),

  {
    category: "herbs",
    name: "Rosemary",
    icon: "🌿",
    keywords: ["protection", "cleansing", "memory"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/rosemary/rosemary-sprig.png", type: "herb", herb: "rosemary", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/rosemary/rosemary-loose.png", type: "herb", herb: "rosemary", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/rosemary/rosemary-oil.png", type: "oil", herb: "rosemary", form: "oil" }
    ]
  },
  {
    category: "herbs",
    name: "Lavender",
    icon: "🌿",
    keywords: ["peace", "sleep", "calming"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/lavender/lavender-sprig.png", type: "herb", herb: "lavender", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/lavender/lavender-loose.png", type: "herb", herb: "lavender", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/lavender/lavender-oil.png", type: "oil", herb: "lavender", form: "oil" }
    ]
  },
  {
    category: "herbs",
    name: "Mugwort",
    icon: "🌿",
    keywords: ["dreams", "intuition", "thresholds"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/mugwort/mugwort-sprig.png", type: "herb", herb: "mugwort", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/mugwort/mugwort-loose.png", type: "herb", herb: "mugwort", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/mugwort/mugwort-oil.png", type: "oil", herb: "mugwort", form: "oil" }
    ]
  },
  {
    category: "herbs",
    name: "Bay Leaf",
    icon: "🌿",
    keywords: ["wishes", "protection", "manifestation"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/bay-leaf/bay-sprig.png", type: "herb", herb: "bay leaf", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/bay-leaf/bay-loose.png", type: "herb", herb: "bay leaf", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/bay-leaf/bay-oil.png", type: "oil", herb: "bay leaf", form: "oil" }
    ]
  },

  {
    category: "crystals",
    name: "Amethyst",
    icon: "💎",
    keywords: ["intuition", "dreams", "calm"],
    forms: [
      { label: "Point", image: "../assets/altar/objects/crystals/amethyst/amethyst-point.png", type: "crystal", crystal: "amethyst", form: "point" },
      { label: "Chips", image: "../assets/altar/objects/crystals/amethyst/amethyst-chips.png", type: "crystal", crystal: "amethyst", form: "chips" },
      { label: "Cluster", image: "../assets/altar/objects/crystals/amethyst/amethyst-cluster.png", type: "crystal", crystal: "amethyst", form: "cluster" },
    ]
  },

  {
    category: "tools",
    name: "Key",
    icon: "🗝️",
    keywords: ["thresholds", "unlocking", "Hekate"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/key/key.png", type: "tool", tool: "key", form: "standard" }]
  },
  {
    category: "tools",
    name: "Athame",
    icon: "🗡️",
    keywords: ["cutting", "will", "boundary"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/athame/athame.png", type: "tool", tool: "athame", form: "standard" }]
  },
  {
    category: "tools",
    name: "Raven Skull",
    icon: "☠️",
    keywords: ["death", "messages", "mystery"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/raven-skull/raven-skull.png", type: "tool", tool: "raven-skull", form: "standard" }]
  },
  {
    category: "tools",
    name: "Black Salt",
    icon: "⚫",
    keywords: ["protection", "banishing", "warding"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/black-salt/black-salt.png", type: "tool", tool: "black-salt", form: "pile" }]
  },

  {
    category: "deities",
    name: "Hekate Statue",
    icon: "🗝️",
    keywords: ["crossroads", "torches", "keys"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/deities/hekate/hekate-statue.png", type: "deity", deity: "hekate", form: "statue" }]
  },

  {
    category: "vessels",
    name: "Cauldron",
    icon: "⚗️",
    keywords: ["transformation", "fire", "spellwork"],
    forms: [{ label: "Place", image: "../assets/altar/objects/vessels/cauldron/cauldron.png", type: "vessel", vessel: "cauldron", form: "standard" }]
  },
  {
    category: "vessels",
    name: "Spell Jar",
    icon: "🫙",
    keywords: ["container", "spell", "intention"],
    forms: [{ label: "Place", image: "../assets/altar/objects/vessels/spell-jar/spell-jar.png", type: "vessel", vessel: "spell-jar", form: "standard" }]
  }
];

function renderCabinetTabs() {
  if (!cabinetTabs) return;

  cabinetTabs.innerHTML = cabinetCategories
    .map((category) => `
      <button
        type="button"
        class="cabinet-tab ${category.id === activeCabinetCategory ? "is-active" : ""}"
        data-cabinet-category="${category.id}">
        <span>${category.icon}</span>
        ${category.label}
      </button>
    `)
    .join("");
}

function renderCabinetItems() {
  if (!cabinetContent) return;

  const search = cabinetSearchTerm.toLowerCase();

  const items = cabinetItems.filter((item) => {
    const matchesCategory = item.category === activeCabinetCategory;
    const searchable = [
      item.name,
      item.category,
      ...(item.grimoireKeywords || [])
    ].join(" ").toLowerCase();

    return matchesCategory && searchable.includes(search);
  });

  if (items.length === 0) {
    cabinetContent.innerHTML = `<p class="cabinet-empty">No cabinet items found.</p>`;
    return;
  }

  cabinetContent.innerHTML = items
    .map((item) => {
      if (item.background) {
        return `
          <button
            type="button"
            class="cabinet-choice-button"
            data-background="${item.background}"
            data-background-name="${item.name}">
            ${item.name}
          </button>
        `;
      }

      const forms = item.forms || [];

      if (forms.length === 1) {
        const form = forms[0];

        return `
          <button
            type="button"
            class="cabinet-choice-button"
            data-image="${form.image || ""}"
            data-label="${item.name}"
            data-type="${form.type || ""}"
            data-herb="${form.herb || ""}"
            data-form="${form.form || ""}"
            data-color="${form.color || ""}"
            data-crystal="${form.crystal || ""}"
            data-tool="${form.tool || ""}"
            data-vessel="${form.vessel || ""}"
            data-deity="${form.deity || ""}">
            ${item.name}
          </button>
        `;
      }

      return `
        <div class="cabinet-choice-wrap">
          <button
            type="button"
            class="cabinet-choice-button"
            data-form-menu-toggle>
            ${item.name}
          </button>

          <div class="cabinet-form-menu" hidden>
            ${forms
              .map((form) => `
                <button
                  type="button"
                  class="cabinet-form-option"
                  data-image="${form.image || ""}"
                  data-label="${item.name} ${form.label}"
                  data-type="${form.type || ""}"
                  data-herb="${form.herb || ""}"
                  data-form="${form.form || ""}"
                  data-color="${form.color || ""}"
                  data-crystal="${form.crystal || ""}"
                  data-tool="${form.tool || ""}"
                  data-vessel="${form.vessel || ""}"
                  data-deity="${form.deity || ""}">
                  ${form.label}
                </button>
              `)
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCabinet() {
  renderCabinetTabs();
  renderCabinetItems();
}


/* =========================================================
   8. SELECTION AND TOOLBAR NOTES
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

function getObjectIcon(object) {
  const type = object.dataset.type;

  if (type === "candle") return "🕯️";
  if (type === "herb") return "🌿";
  if (type === "oil") return "🧴";
  if (type === "crystal") return "💎";
  if (type === "deity") return "🗝️";
  if (type === "vessel") return "🏺";
  if (type === "tool") return "✦";

  return "✦";
}

function getObjectTypeLabel(object) {
  const type = object.dataset.type || "altar object";
  const form = object.dataset.form || "";

  if (form && form !== "standard") {
    return `${type} · ${form}`;
  }

  return type;
}

function showAltarInfoCard(object) {
  if (!altarInfoCard || !object) return;

  const label = object.dataset.label || "Altar Object";
  const activeGroup = object.dataset.groupId
    ? altarGroups.find((group) => group.id === object.dataset.groupId)
    : null;

  const dressings = getDressings(object);
  const oils = dressings
    .filter((dressing) => dressing.type === "oil")
    .map((dressing) => dressing.herb)
    .filter(Boolean);

  const herbs = dressings
    .filter((dressing) => dressing.type === "herb")
    .map((dressing) => dressing.herb)
    .filter(Boolean);

  const dressingMarkup =
    oils.length || herbs.length
      ? `
        <div class="altar-info-card-section">
          <p>Dressing</p>
          ${oils.length ? `<p><strong>Oil:</strong> ${oils.join(", ")}</p>` : ""}
          ${herbs.length ? `<p><strong>Herb:</strong> ${herbs.join(", ")}</p>` : ""}
        </div>
      `
      : "";

   const groupItems = activeGroup
     ? getGroupObjects(activeGroup.id).map((item) => item.dataset.label || "Item")
     : [];
   
   const groupMarkup = activeGroup
     ? `
       <div class="altar-info-card-section">
         <p><strong>Group:</strong> ${activeGroup.name}</p>
         <p>${groupItems.join(", ")}</p>
       </div>
     `
     : "";

  altarInfoCard.innerHTML = `
    <div class="altar-info-card-inner">
      <h3>${label}</h3>
      ${object.dataset.grimoireKeywords ? `<p class="altar-info-card-type">${object.dataset.grimoireKeywords}</p>` : ""}
      ${groupMarkup}
      ${dressingMarkup}
    </div>
  `;

  altarInfoCard.hidden = false;
  altarInfoCard.classList.add("is-visible");
}
function hideAltarInfoCard() {
  if (!altarInfoCard) return;

  altarInfoCard.classList.remove("is-visible");

  window.setTimeout(() => {
    if (!altarInfoCard.classList.contains("is-visible")) {
      altarInfoCard.hidden = true;
    }
  }, 180);
}

function updateToolbarNotes(object) {
  let notes = toolbar.querySelector(".altar-toolbar-notes");

  if (!notes) {
    notes = document.createElement("div");
    notes.className = "altar-toolbar-notes";
    toolbar.appendChild(notes);
  }

  if (!object || object.dataset.type !== "candle") {
    notes.hidden = true;
    notes.textContent = "";
    return;
  }

  const dressings = getDressings(object);

  if (dressings.length === 0) {
    notes.hidden = true;
    notes.textContent = "";
    return;
  }

  notes.hidden = false;
  notes.textContent = `Dressed with: ${dressings
    .map(formatDressingName)
    .join(", ")}`;
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
  showAltarInfoCard(selectedObject);
  updateSelectedGroupVisuals(selectedObject);
}

function deselectObject() {
  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = null;
  toolbar.hidden = true;

  updateToolbarNotes(null);
  hideAltarInfoCard();
  updateSelectedGroupVisuals(null);
}


/* =========================================================
   9. OBJECT TRANSFORMS
   ========================================================= */

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
function rotateObject(object) {
  if (!object || object.dataset.locked === "true") return;

  const rotation = Number(object.dataset.rotation || 0) + 15;

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


/* =========================================================
   10. CANDLE LIGHTING
   ========================================================= */

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


/* =========================================================
   11. CANDLE DRESSING
   ========================================================= */

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

  if (overlay) {
    overlay.remove();
  }
}

function updateCandleDressingVisuals(candle) {
  if (!candle || candle.dataset.type !== "candle") return;

  const dressings = getDressings(candle);

  const hasHerbDressing = dressings.some(
    (dressing) =>
      dressing.type === "herb" &&
      dressing.form === "loose"
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
 
/* =========================================================
   13. OBJECT CREATION AND DRAGGING
   ========================================================= */

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
    activeObject = null;
  });

  object.addEventListener("pointercancel", () => {
    object.classList.remove("is-dragging");
    activeObject = null;
  });

   object.addEventListener("wheel", (event) => {
     if (selectedObject !== object) return;
   
     event.preventDefault();
   
     if (object.dataset.locked === "true") return;
   
     resizeObject(object, event.deltaY < 0 ? 0.1 : -0.1);
   });

   object.addEventListener("dblclick", () => {
     deleteObject(object);
   });
}

function placeObject(options) {
  if (!altarStage) return;

  const { imagePath, fallbackSymbol, label, type, herb, form, color } = options;
  const object = document.createElement("button");
  const isMobile = window.innerWidth <= 768;

  object.type = "button";
  object.className = "altar-object";

  object.dataset.label = label || "object";
  object.dataset.type = type || "";
  object.dataset.herb = herb || "";
  object.dataset.form = form || "";
  object.dataset.color = color || "";
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

   const scale = Number(object.dataset.scale || 1);
   const centerX = altarStage.clientWidth / 2;
   const centerY = altarStage.clientHeight / 2;
   
   object.style.left = `${centerX - (object.offsetWidth * scale) / 2}px`;
   object.style.top = `${centerY - (object.offsetHeight * scale) / 2}px`;
   
   updateObjectPositionPercent(object);

  updateObjectTransform(object);
  makeDraggable(object);

  altarStage.appendChild(object);
  selectObject(object);
  updateEmptyMessage();
}

function deleteObject(object) {
  if (!object) return;

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

function toggleRitualSelectionMode() {
  altarSelectionMode = !altarSelectionMode;
  altarStage.classList.toggle("is-selecting-ritual-items", altarSelectionMode);

  if (!altarSelectionMode) {
    clearRitualSelection();
    showAltarToast("Selection cancelled");
    return;
  }

  deselectObject();
  clearCandleDressingMode();
  showAltarToast("Select items");
}

function toggleRitualItem(object) {
  if (!object) return;

  const alreadySelected = selectedRitualItems.includes(object);

  if (alreadySelected) {
    selectedRitualItems = selectedRitualItems.filter((item) => item !== object);
    object.classList.remove("is-ritual-selected");
    return;
  }

  selectedRitualItems.push(object);
  object.classList.add("is-ritual-selected");
}

function clearRitualSelection() {
  selectedRitualItems.forEach((object) => {
    object.classList.remove("is-ritual-selected");
  });

  selectedRitualItems = [];
  altarSelectionMode = false;
  altarStage.classList.remove("is-selecting-ritual-items");
}

function altarObjectToRitualItem(object) {
  return {
    id: object.dataset.altarObjectId || "",
    label: object.dataset.label || "Altar Item",
    type: object.dataset.type || "item",
    herb: object.dataset.herb || "",
    form: object.dataset.form || "",
    color: object.dataset.color || "",
    dressings: object.dataset.dressings || "[]"
  };
}

function ensureObjectId(object) {
  if (!object.dataset.altarObjectId) {
    object.dataset.altarObjectId =
      crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  }

  return object.dataset.altarObjectId;
}

function getGroupById(groupId) {
  return altarGroups.find((group) => group.id === groupId) || null;
}

function getActiveGroup() {
  return getGroupById(activeGroupId);
}

function getGroupObjects(groupId) {
  const group = getGroupById(groupId);

  if (!group || !Array.isArray(group.objectIds)) return [];

  return group.objectIds
    .map((objectId) =>
      altarStage.querySelector(`.altar-object[data-altar-object-id="${objectId}"]`)
    )
    .filter(Boolean);
}

function syncGroupObjectClasses() {
  altarStage.querySelectorAll(".altar-object").forEach((object) => {
    object.classList.remove("is-ritual-grouped", "is-group-active");
  });
}

function updateSelectedGroupVisuals(object) {
  altarStage.querySelectorAll(".altar-object").forEach((item) => {
    item.classList.remove("is-group-active");
  });

  if (!object || !object.dataset.groupId) return;

  getGroupObjects(object.dataset.groupId).forEach((groupObject) => {
    if (groupObject !== object) {
      groupObject.classList.add("is-group-active");
    }
  });
}

function updateGroupIndicator() {
  if (!altarGroupIndicator) return;

  const activeGroup = getActiveGroup();

  if (!activeGroup) {
    altarGroupIndicator.hidden = true;
    altarGroupIndicator.textContent = "";
    return;
  }

  const itemCount = getGroupObjects(activeGroup.id).length;

  altarGroupIndicator.hidden = false;
  altarGroupIndicator.textContent =
    `Active group: ${activeGroup.name} · ${itemCount} item${itemCount === 1 ? "" : "s"}`;
}

function chooseActiveGroup() {
  if (altarGroups.length === 0) {
    showAltarToast("Create a group first");
    return null;
  }

  if (altarGroups.length === 1) {
    activeGroupId = altarGroups[0].id;
    updateGroupIndicator();
    return altarGroups[0];
  }

  const groupList = altarGroups
    .map((group, index) => {
      const itemCount = getGroupObjects(group.id).length;
      return `${index + 1}. ${group.name} (${itemCount} item${itemCount === 1 ? "" : "s"})`;
    })
    .join("\n");

  const choice = window.prompt(`Choose a group:\n\n${groupList}`, "1");
  const selectedIndex = Number(choice) - 1;
  const selectedGroup = altarGroups[selectedIndex];

  if (!selectedGroup) {
    showAltarToast("No group selected");
    return null;
  }

  activeGroupId = selectedGroup.id;
  updateGroupIndicator();

  return selectedGroup;
}

function groupSelectedRitualItems() {
  if (selectedRitualItems.length === 0) {
    showAltarToast("Select items first");
    return;
  }

  const groupName =
    window.prompt("Name this group:", "Ritual Working") || "Ritual Working";

  const groupId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

  const objectIds = selectedRitualItems.map((object) => {
    const objectId = ensureObjectId(object);

    object.dataset.groupId = groupId;
    object.classList.remove("is-ritual-selected");

    return objectId;
  });

  const newGroup = {
    id: groupId,
    name: groupName.trim() || "Ritual Working",
    createdAt: new Date().toISOString(),
    objectIds
  };

  altarGroups.push(newGroup);
  activeGroupId = groupId;

  selectedRitualItems = [];
  altarSelectionMode = false;
  altarStage.classList.remove("is-selecting-ritual-items");

  syncGroupObjectClasses();
  updateGroupIndicator();
  showAltarToast("Group created");
}

function ungroupCurrentItems() {
  const activeGroup = chooseActiveGroup();
  if (!activeGroup) return;

  getGroupObjects(activeGroup.id).forEach((object) => {
    delete object.dataset.groupId;
  });

  altarGroups = altarGroups.filter((group) => group.id !== activeGroup.id);
  activeGroupId = altarGroups.length > 0 ? altarGroups[0].id : null;

  syncGroupObjectClasses();
  updateGroupIndicator();
  showAltarToast("Group removed");
}

function sendCurrentGroupToGrimoire() {
  const activeGroup = chooseActiveGroup();
  if (!activeGroup) return;

  const groupObjects = getGroupObjects(activeGroup.id);

  if (groupObjects.length === 0) {
    showAltarToast("That group is empty");
    return;
  }

  const handoffGroup = {
    id: activeGroup.id,
    name: activeGroup.name,
    createdAt: activeGroup.createdAt,
    items: groupObjects.map(altarObjectToRitualItem)
  };

  localStorage.setItem(
    ALTAR_GRIMOIRE_HANDOFF_KEY,
    JSON.stringify(handoffGroup)
  );

  window.location.href = "../grimoire/index.html?import=altar";
}
