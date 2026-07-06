/* =========================================================
   ALTAR STORAGE
   Local saves, cloud saves, saved altar manager, load/clear
   ========================================================= */

const ALTAR_DRAFT_KEY = "saltAndSovereigntyWorkingAltarDraft";
let isRestoringAltarDraft = false;
let altarDraftSaveTimeout = null;

function getStagePositionPercent(object) {
  const scale = Number(object.dataset.scale || 1);
  const leftPx = parseFloat(object.style.left) || 0;
  const topPx = parseFloat(object.style.top) || 0;

  const visualWidth = object.offsetWidth * scale;
  const visualHeight = object.offsetHeight * scale;

  const centerX = leftPx + visualWidth / 2;
  const centerY = topPx + visualHeight / 2;

  return {
    leftPercent: altarStage.clientWidth ? centerX / altarStage.clientWidth : 0,
    topPercent: altarStage.clientHeight ? centerY / altarStage.clientHeight : 0,
    sizePercent: altarStage.clientWidth ? visualWidth / altarStage.clientWidth : 0.08
  };
}

function applyStagePositionPercent(object, savedObject) {
  const leftPercent =
    typeof savedObject.leftPercent === "number" ? savedObject.leftPercent : 0.5;

  const topPercent =
    typeof savedObject.topPercent === "number" ? savedObject.topPercent : 0.5;

  const sizePercent =
    typeof savedObject.sizePercent === "number" ? savedObject.sizePercent : null;

  if (sizePercent) {
    const newVisualWidth = altarStage.clientWidth * sizePercent;
    const newScale = newVisualWidth / object.offsetWidth;

    object.dataset.scale = String(newScale);
    updateObjectTransform(object);
  }

  const scale = Number(object.dataset.scale || 1);
  const visualWidth = object.offsetWidth * scale;
  const visualHeight = object.offsetHeight * scale;

  const centerX = leftPercent * altarStage.clientWidth;
  const centerY = topPercent * altarStage.clientHeight;

  object.dataset.leftPercent = String(leftPercent);
  object.dataset.topPercent = String(topPercent);

  if (sizePercent) {
    object.dataset.sizePercent = String(sizePercent);
  }

  object.style.left = `${centerX - visualWidth / 2}px`;
  object.style.top = `${centerY - visualHeight / 2}px`;
}

function updateObjectPositionPercent(object) {
  if (!altarStage || !object) return;

  const position = getStagePositionPercent(object);

  object.dataset.leftPercent = String(position.leftPercent);
  object.dataset.topPercent = String(position.topPercent);
  object.dataset.sizePercent = String(position.sizePercent);
}

function repositionAllObjectsFromPercent() {
  if (!altarStage) return;

  altarStage.querySelectorAll(".altar-object").forEach((object) => {
    applyStagePositionPercent(object, {
      leftPercent: Number(object.dataset.leftPercent),
      topPercent: Number(object.dataset.topPercent),
      sizePercent: Number(object.dataset.sizePercent)
    });

    keepObjectInsideStage(object);
  });
}

function createAltarSnapshot(name = "Working Altar") {
  if (!altarStage) return null;

  const objects = Array.from(altarStage.querySelectorAll(".altar-object")).map((object) => {
    const position = getStagePositionPercent(object);

    console.log("Saving object:", {
        label: object.dataset.label,
        entityId: object.dataset.entityId,
        instanceId: object.dataset.instanceId
    });
    
    return {
      imagePath: getObjectImagePath(object),
      fallbackSymbol: object.textContent || "",
      label: object.dataset.label || "object",
      type: object.dataset.type || "",
      entityId: object.dataset.entityId || "",
      instanceId: object.dataset.instanceId || "",
      herb: object.dataset.herb || "",
      form: object.dataset.form || "",
      color: object.dataset.color || "",
      crystal: object.dataset.crystal || "",
      tool: object.dataset.tool || "",
      vessel: object.dataset.vessel || "",
      deity: object.dataset.deity || "",
      apothecaryItemId: object.dataset.apothecaryItemId || "",
      apothecaryType: object.dataset.apothecaryType || "",
      apothecaryIngredients: object.dataset.apothecaryIngredients || "[]",
      apothecaryIntention: object.dataset.apothecaryIntention || "",
      apothecaryNotes: object.dataset.apothecaryNotes || "",
      apothecaryLogToGrimoire: object.dataset.apothecaryLogToGrimoire || "false",
      apothecaryGrimoireStatus: object.dataset.apothecaryGrimoireStatus || "",
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
    id: "working-draft",
    name,
    savedAt: new Date().toISOString(),
    background: altarStage.dataset.background || "",
    backgroundName: altarStage.dataset.backgroundName || "",
    groups: altarGroups,
    activeGroupId,
    objects
  };
}

function saveWorkingAltarDraft() {
  if (!altarStage || isRestoringAltarDraft) return;

  window.clearTimeout(altarDraftSaveTimeout);

  altarDraftSaveTimeout = window.setTimeout(() => {
    const draft = createAltarSnapshot();

    if (!draft) return;

    localStorage.setItem(ALTAR_DRAFT_KEY, JSON.stringify(draft));
  }, 250);
}

function clearWorkingAltarDraft() {
  localStorage.removeItem(ALTAR_DRAFT_KEY);
}

function getWorkingAltarDraft() {
  try {
    return JSON.parse(localStorage.getItem(ALTAR_DRAFT_KEY));
  } catch {
    return null;
  }
}

function getLocalSavedAltars() {
  const saved = localStorage.getItem(ALTAR_STORAGE_KEY);

  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function storeLocalSavedAltars(savedAltars) {
  localStorage.setItem(ALTAR_STORAGE_KEY, JSON.stringify(savedAltars));
}

async function getSavedAltars() {
  const user = await ensureAltarUser();

  if (!user) {
    return getLocalSavedAltars();
  }

  const { data, error } = await db
    .from(ALTAR_CLOUD_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showAltarToast("Could not load cloud saves");
    return [];
  }

  return data.map((row) => ({
    ...(row.altar_data || {}),
    id: row.id,
    name: row.name,
    savedAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function migrateLocalAltarsToCloud() {
  const user = await ensureAltarUser();

  if (!user) return;

  const alreadyMigrated = localStorage.getItem(ALTAR_MIGRATION_KEY);
  if (alreadyMigrated === "true") return;

  const localAltars = getLocalSavedAltars();

  if (localAltars.length === 0) {
    localStorage.setItem(ALTAR_MIGRATION_KEY, "true");
    return;
  }

  const rows = localAltars.map((altar) => ({
    user_id: user.id,
    name: altar.name || "My Altar",
    altar_data: altar
  }));

  const { error } = await db.from(ALTAR_CLOUD_TABLE).insert(rows);

  if (error) {
    console.error(error);
    showAltarToast("Local altar migration failed");
    return;
  }

  localStorage.setItem(ALTAR_MIGRATION_KEY, "true");
  showAltarToast("Local altars synced");
}

async function saveAltar() {
  if (!altarStage) return;

  const altarName =
    window.prompt("Name this altar save:", "My Altar") || "My Altar";

  const altarData = createAltarSnapshot(altarName.trim() || "My Altar");

  if (!altarData) return;

  const user = await ensureAltarUser();

  if (!user) {
    const savedAltars = getLocalSavedAltars();

    savedAltars.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ...altarData
    });

    storeLocalSavedAltars(savedAltars);
    showAltarToast(`Saved locally: ${altarData.name}`);
    return;
  }

  const { error } = await db.from(ALTAR_CLOUD_TABLE).insert({
    user_id: user.id,
    name: altarData.name,
    altar_data: altarData
  });

  if (error) {
    console.error(error);
    showAltarToast("Cloud save failed");
    return;
  }

  showAltarToast(`Saved: ${altarData.name}`);
}

function createSavedObject(savedObject) {
  const object = document.createElement("button");

  object.type = "button";
  object.className = "altar-object";

  object.dataset.label = savedObject.label || "object";
  object.dataset.type = savedObject.type || "";
  object.dataset.entityId = savedObject.entityId || "";
  object.dataset.instanceId = savedObject.instanceId || "";
  object.dataset.herb = savedObject.herb || "";
  object.dataset.form = savedObject.form || "";
  object.dataset.color = savedObject.color || "";
  object.dataset.crystal = savedObject.crystal || "";
  object.dataset.tool = savedObject.tool || "";
  object.dataset.vessel = savedObject.vessel || "";
  object.dataset.deity = savedObject.deity || "";
  object.dataset.apothecaryItemId = savedObject.apothecaryItemId || "";
  object.dataset.apothecaryType = savedObject.apothecaryType || "";
  object.dataset.apothecaryIngredients = savedObject.apothecaryIngredients || "[]";
  object.dataset.apothecaryIntention = savedObject.apothecaryIntention || "";
  object.dataset.apothecaryNotes = savedObject.apothecaryNotes || "";
  object.dataset.apothecaryLogToGrimoire = savedObject.apothecaryLogToGrimoire || "false";
  object.dataset.apothecaryGrimoireStatus = savedObject.apothecaryGrimoireStatus || "";
  object.dataset.scale = savedObject.scale || "1";
  object.dataset.rotation = savedObject.rotation || "0";
  object.dataset.flipped = savedObject.flipped || "false";
  object.dataset.locked = savedObject.locked || "false";
  object.dataset.glowing = savedObject.glowing || "false";
  object.dataset.lit = savedObject.lit || "false";
  object.dataset.dressings = savedObject.dressings || "[]";
  object.dataset.plaqueText = savedObject.plaqueText || "";
  object.dataset.altarObjectId = savedObject.altarObjectId || "";
  object.dataset.groupId = savedObject.groupId || "";

  object.style.zIndex = savedObject.zIndex || "10";

  highestLayer = Math.max(highestLayer, Number(savedObject.zIndex || 10));

  if (savedObject.imagePath) {
    const img = document.createElement("img");
    img.src = savedObject.imagePath;
    img.alt = savedObject.label || "altar object";
    img.draggable = false;
    object.appendChild(img);
  } else {
    object.textContent = savedObject.fallbackSymbol || "";
  }

  object.setAttribute(
    "aria-label",
    `${savedObject.label || "Object"}. Click to select. Drag to move. Double click to remove.`
  );

  if (object.dataset.glowing === "true") {
    object.classList.add("has-glow");
  }

  if (object.dataset.locked === "true") {
    object.classList.add("is-locked");
  }

    if (object.dataset.lit === "true" && object.dataset.type === "candle") {
    object.classList.add("is-lit");

    window.setTimeout(() => {
      stopFlame(object);
      startFlame(object);
      renderLighting();
    }, 50);
  } else {
    object.dataset.lit = "false";
    object.classList.remove("is-lit", "has-flame-glow", "is-flame-glowing");
  }

  updateCandleDressingVisuals(object);
  makeDraggable(object);

  return object;
}

function restoreAltarData(altarData) {
  if (!altarStage || !altarData) return;

  isRestoringAltarDraft = true;

  altarStage.querySelectorAll(".altar-object").forEach((object) => {
    stopFlame(object);
    object.remove();
  });

  deselectObject();
  clearCandleDressingMode();

  if (altarData.background) {
    altarStage.style.backgroundImage = `url("${altarData.background}")`;
    altarStage.dataset.background = altarData.background;
    altarStage.dataset.backgroundName = altarData.backgroundName || "";
  }

  altarGroups = Array.isArray(altarData.groups) ? altarData.groups : [];
  activeGroupId = altarData.activeGroupId || null;

  (altarData.objects || []).forEach((savedObject) => {
    const object = createSavedObject(savedObject);
    altarStage.appendChild(object);

    const img = object.querySelector("img");

    function positionLoadedObject() {
      applyStagePositionPercent(object, savedObject);
      updateObjectTransform(object);
      keepObjectInsideStage(object);
      updateObjectPositionPercent(object);
    }

    if (img && !img.complete) {
      img.addEventListener("load", positionLoadedObject, { once: true });
    } else {
      positionLoadedObject();
    }
  });

  updateGroupIndicator();
  syncGroupObjectClasses();
  updateEmptyMessage();

  window.setTimeout(() => {
    isRestoringAltarDraft = false;
    saveWorkingAltarDraft();
  }, 200);
}

function restoreWorkingAltarDraft() {
  const draft = getWorkingAltarDraft();

  if (!draft || !Array.isArray(draft.objects) || draft.objects.length === 0) return;

  restoreAltarData(draft);
  showAltarToast("Working altar restored");
}

async function loadAltarById(altarId) {
  if (!altarStage) return;

  const savedAltars = await getSavedAltars();
  const altarData = savedAltars.find((altar) => altar.id === altarId);

  if (!altarData) {
    showAltarToast("Altar not found");
    return;
  }

  restoreAltarData(altarData);
  closeSavedAltarsManager();
  showAltarToast(`Loaded: ${altarData.name || "Altar"}`);
}

async function renameSavedAltar(altarId) {
  const savedAltars = await getSavedAltars();
  const altar = savedAltars.find((savedAltar) => savedAltar.id === altarId);

  if (!altar) return;

  const newName = window.prompt("Rename this altar:", altar.name || "My Altar");

  if (!newName || !newName.trim()) return;

  const user = await ensureAltarUser();

  if (!user) {
    altar.name = newName.trim();
    altar.updatedAt = new Date().toISOString();
    storeLocalSavedAltars(savedAltars);
  } else {
    const { error } = await db
      .from(ALTAR_CLOUD_TABLE)
      .update({
        name: newName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", altarId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      showAltarToast("Rename failed");
      return;
    }
  }

  await renderSavedAltarsManager();
  showAltarToast("Altar renamed");
}

async function deleteSavedAltar(altarId) {
  const savedAltars = await getSavedAltars();
  const altar = savedAltars.find((savedAltar) => savedAltar.id === altarId);

  if (!altar) return;

  const confirmed = window.confirm(
    `Delete "${altar.name || "Untitled Altar"}"? This cannot be undone.`
  );

  if (!confirmed) return;

  const user = await ensureAltarUser();

  if (!user) {
    storeLocalSavedAltars(
      savedAltars.filter((savedAltar) => savedAltar.id !== altarId)
    );
  } else {
    const { error } = await db
      .from(ALTAR_CLOUD_TABLE)
      .delete()
      .eq("id", altarId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      showAltarToast("Delete failed");
      return;
    }
  }

  await renderSavedAltarsManager();
  showAltarToast("Altar deleted");
}

const savedAltarsManager = document.createElement("div");
savedAltarsManager.className = "saved-altars-modal";
savedAltarsManager.hidden = true;
savedAltarsManager.innerHTML = `
  <div class="saved-altars-card saved-altars-library" role="dialog" aria-modal="true" aria-labelledby="saved-altars-title">
    <button class="saved-altars-close" type="button" data-saved-altars-close aria-label="Close">
      ×
    </button>

    <div class="saved-altars-header">
      <p class="eyebrow">Saved Sanctuaries</p>
      <h2 id="saved-altars-title">My Altars</h2>
      <p>
        Return to a saved altar, rename a working, or clear away what no longer belongs.
      </p>
    </div>

    <div class="saved-altars-list saved-altars-grid" data-saved-altars-list></div>
  </div>
`;

document.body.appendChild(savedAltarsManager);

const savedAltarsList = savedAltarsManager.querySelector("[data-saved-altars-list]");
const savedAltarsClose = savedAltarsManager.querySelector("[data-saved-altars-close]");

function formatSavedAltarDate(altar) {
  const rawDate = altar.updatedAt || altar.savedAt;

  if (!rawDate) return "No date saved";

  return new Date(rawDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getSavedAltarSummary(altar) {
  const objects = Array.isArray(altar.objects) ? altar.objects : [];
  const itemCount = objects.length;
  const candleCount = objects.filter((object) => object.type === "candle").length;
  const herbCount = objects.filter((object) => object.type === "herb" || object.type === "oil").length;
  const crystalCount = objects.filter((object) => object.type === "crystal").length;

  const pieces = [`${itemCount} item${itemCount === 1 ? "" : "s"}`];

  if (candleCount) pieces.push(`${candleCount} candle${candleCount === 1 ? "" : "s"}`);
  if (herbCount) pieces.push(`${herbCount} herb${herbCount === 1 ? "" : "s"}`);
  if (crystalCount) pieces.push(`${crystalCount} crystal${crystalCount === 1 ? "" : "s"}`);

  return pieces.join(" · ");
}

async function renderSavedAltarsManager() {
  const savedAltars = await getSavedAltars();

  if (!savedAltarsList) return;

  if (savedAltars.length === 0) {
    savedAltarsList.innerHTML = `
      <div class="saved-altars-empty">
        <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
        <h3>No saved altars yet.</h3>
        <p>
          Build an altar, then use Save to keep it in your Sanctuary.
        </p>
      </div>
    `;
    return;
  }

  savedAltarsList.innerHTML = savedAltars
    .map((altar) => {
      const date = formatSavedAltarDate(altar);
      const summary = getSavedAltarSummary(altar);
      const backgroundName = altar.backgroundName || "Custom altar";

      return `
        <article class="saved-altar-row saved-altar-card" data-saved-altar-id="${altar.id}">
          <div class="saved-altar-symbol" aria-hidden="true">🕯</div>

          <div class="saved-altar-body">
            <p class="eyebrow">${backgroundName}</p>
            <h3>${altar.name || "Untitled Altar"}</h3>
            <p>${summary}</p>
            <p class="saved-altar-date">Saved ${date}</p>
          </div>

          <div class="saved-altar-actions">
            <button type="button" data-saved-action="load">Load</button>
            <button type="button" data-saved-action="rename">Rename</button>
            <button type="button" data-saved-action="delete">Delete</button>
            <button type="button" disabled title="Coming soon">Duplicate</button>
            <button type="button" disabled title="Coming soon">Favorite</button>
            <button type="button" disabled title="Coming soon">Share</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function openSavedAltarsManager() {
  await migrateLocalAltarsToCloud();
  await renderSavedAltarsManager();

  savedAltarsManager.hidden = false;
  document.body.classList.add("altar-modal-open");
}

function closeSavedAltarsManager() {
  savedAltarsManager.hidden = true;
  document.body.classList.remove("altar-modal-open");
}

async function loadAltar() {
  await openSavedAltarsManager();
}

function clearAltar() {
  if (!altarStage) return;

  altarStage.querySelectorAll(".altar-object").forEach((object) => {
    stopFlame(object);
    object.remove();
  });

  altarGroups = [];
  activeGroupId = null;

  deselectObject();
  clearCandleDressingMode();
  updateGroupIndicator();
  updateEmptyMessage();
  clearWorkingAltarDraft();
}
