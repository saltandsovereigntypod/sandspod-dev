/* =========================================================
   ALTAR STORAGE
   Local saves, cloud saves, saved altar manager, load/clear
   ========================================================= */

const ALTAR_DRAFT_KEY = "saltAndSovereigntyWorkingAltarDraft";
let isRestoringAltarDraft = false;
let altarDraftSaveTimeout = null;
let altarDraftDirty = false;
let altarSaveInFlight = false;
let altarContentDirty = false;
let savedAltarsFilter = "all";
let savedAltarsSort = "default";
const favoriteUpdatesInFlight = new Set();
const duplicateAltarsInFlight = new Set();
let activeSavedAltar = {
  savedAltarId: "", savedAltarName: "", source: "new", loadedAt: "",
  lastSavedAt: "", ownerScope: "guest", ownerId: ""
};
window.currentSavedAltarId = "";

function setActiveSavedAltar(altar = null, options = {}) {
  activeSavedAltar = altar ? {
    savedAltarId: altar.id || "", savedAltarName: altar.name || "Untitled Altar",
    source: options.source || "loaded", loadedAt: options.loadedAt || new Date().toISOString(),
    lastSavedAt: options.lastSavedAt || altar.updatedAt || altar.savedAt || "",
    ownerScope: options.ownerScope || "guest", ownerId: options.ownerId || ""
  } : { savedAltarId: "", savedAltarName: "", source: "new", loadedAt: "", lastSavedAt: "", ownerScope: "guest", ownerId: "" };
  window.currentSavedAltarId = activeSavedAltar.savedAltarId;
}

function markAltarClean() { altarContentDirty = false; }
function markAltarDirty() { if (!isRestoringAltarDraft) altarContentDirty = true; }
window.getActiveSavedAltar = () => ({ ...activeSavedAltar, dirty: altarContentDirty });
document.addEventListener("saltAuthChanged", (event) => {
  if (!activeSavedAltar.savedAltarId) return;
  const user = event.detail?.user || null;
  const scopeChanged = user ? activeSavedAltar.ownerScope !== "authenticated" : activeSavedAltar.ownerScope !== "guest";
  const ownerChanged = user && activeSavedAltar.ownerId && activeSavedAltar.ownerId !== user.id;
  if (scopeChanged || ownerChanged) setActiveSavedAltar(null);
});

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
    if (!object.dataset.livingState && typeof initializeLivingObjectState === "function") {
      initializeLivingObjectState(object);
    }
    const position = getStagePositionPercent(object);
    
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
      ritualIncluded: object.dataset.ritualIncluded || "false",
      livingState: object.dataset.livingState || "",
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
    name,
    savedAt: new Date().toISOString(),
    background: altarStage.dataset.background || "",
    backgroundName: altarStage.dataset.backgroundName || "",
    groups: altarGroups,
    activeGroupId,
    objects
  };
}

function persistWorkingAltarDraft(snapshot = null) {
  window.clearTimeout(altarDraftSaveTimeout);
  altarDraftSaveTimeout = null;

  const draft = snapshot || createAltarSnapshot();
  if (!draft) return false;

  window.SaltAccountData?.markGuestDataChanged?.(localStorage);
  localStorage.setItem(ALTAR_DRAFT_KEY, JSON.stringify({
    ...draft,
    id: "working-draft",
    name: "Working Altar"
  }));
  altarDraftDirty = false;
  return true;
}

function saveWorkingAltarDraft(options = {}) {
  if (!altarStage || isRestoringAltarDraft) return;

  altarDraftDirty = true;
  markAltarDirty();
  window.clearTimeout(altarDraftSaveTimeout);

  if (options.immediate) {
    persistWorkingAltarDraft(options.snapshot || null);
    return;
  }

  altarDraftSaveTimeout = window.setTimeout(() => {
    persistWorkingAltarDraft();
  }, 250);
}

function flushWorkingAltarDraft() {
  if (!altarDraftDirty || isRestoringAltarDraft) return;
  persistWorkingAltarDraft();
}

function clearWorkingAltarDraft() {
  window.clearTimeout(altarDraftSaveTimeout);
  altarDraftSaveTimeout = null;
  altarDraftDirty = false;
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
  window.SaltAccountData?.markGuestDataChanged?.(localStorage);
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
    _altarData: row.altar_data || {},
    id: row.id,
    name: row.name,
    savedAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function migrateLocalAltarsToCloud() {
  // Guest records are never transferred as a side effect of sign-in. The
  // Account & Data migration preview owns all review, backup and cloud writes.
  return { pending: getLocalSavedAltars().length > 0 };
}

function reconcileCandlesForSave() {
  altarStage.querySelectorAll('.altar-object[data-type="candle"]').forEach((candle) => {
    if (typeof window.reconcileCandleObject === "function") window.reconcileCandleObject(candle);
  });
}

function newSavedAltarId() {
  return crypto.randomUUID ? crypto.randomUUID() : `altar-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createSavedAltar(altarData, user) {
  const id = newSavedAltarId();
  const now = new Date().toISOString();
  if (!user) {
    storeLocalSavedAltars([{ id, ...altarData, savedAt: now, updatedAt: now }, ...getLocalSavedAltars()]);
    return { id, ...altarData, savedAt: now, updatedAt: now };
  }
  const { data, error } = await db.from(ALTAR_CLOUD_TABLE).insert({ id, user_id: user.id, name: altarData.name, altar_data: altarData }).select().single();
  if (error) throw error;
  return { ...altarData, id: data?.id || id, savedAt: data?.created_at || now, updatedAt: data?.updated_at || now };
}

async function updateSavedAltar(savedAltarId, altarData, user) {
  const existing = (await getSavedAltars()).find((altar) => altar.id === savedAltarId);
  if (!existing) throw new Error("The active saved Altar no longer exists.");
  const now = new Date().toISOString();
  if (!user) {
    const rows = getLocalSavedAltars();
    const index = rows.findIndex((altar) => altar.id === savedAltarId);
    if (index < 0) throw new Error("The active guest Altar no longer exists.");
    rows[index] = { ...rows[index], ...altarData, id: savedAltarId, savedAt: rows[index].savedAt || existing.savedAt, updatedAt: now };
    storeLocalSavedAltars(rows);
    return rows[index];
  }
  const updatedAltarData = { ...(existing._altarData || {}), ...altarData, name: existing.name };
  const { data, error } = await db.from(ALTAR_CLOUD_TABLE).update({ name: existing.name, altar_data: updatedAltarData, updated_at: now }).eq("id", savedAltarId).eq("user_id", user.id).select().single();
  if (error || !data) throw error || new Error("The saved Altar could not be updated.");
  return { ...altarData, id: savedAltarId, name: existing.name, savedAt: data.created_at || existing.savedAt, updatedAt: data.updated_at || now };
}

async function materializeFreshObjectInstances(snapshot, user) {
  if (!user || typeof window.createObjectInstance !== "function") return { snapshot, createdIds: [] };
  const planned = JSON.parse(JSON.stringify(snapshot));
  const createdIds = [];
  try {
    for (const object of planned.objects || []) {
      const instance = await window.createObjectInstance({
        entity_id: object.entityId || null, source: "altar", instance_type: "placed_object",
        name: object.label || "Altar object", object_type: object.type || "",
        subtype: object.form || object.crystal || object.herb || object.tool || object.vessel || "",
        altar_object_key: object.altarObjectId, apothecary_item_id: object.apothecaryItemId || "",
        remaining_burn_seconds: object.type === "candle" ? Math.round((JSON.parse(object.livingState || "{}").candle?.expectedBurnMs || 0) / 1000) : null,
        total_burn_seconds: object.type === "candle" ? 0 : null,
        metadata: { freshAltarDuplicate: true }
      });
      if (!instance?.id) throw new Error("A fresh object instance could not be created.");
      object.instanceId = instance.id;
      createdIds.push(instance.id);
    }
    return { snapshot: planned, createdIds };
  } catch (error) {
    await rollbackFreshObjectInstances(createdIds, user);
    throw error;
  }
}

async function rollbackFreshObjectInstances(ids, user) {
  if (!user || !ids.length || typeof db === "undefined") return;
  for (const id of ids) {
    const { error } = await db.from("object_instances").delete().eq("id", id).eq("user_id", user.id);
    if (error) console.warn("Fresh Altar rollback could not remove an object instance.");
  }
}

async function duplicateSavedAltar(source, mode, name, user) {
  if (!source?.id || !["new-view", "fresh"].includes(mode)) throw new Error("Choose a valid saved Altar and duplicate mode.");
  const sourceData = JSON.parse(JSON.stringify(source._altarData || source));
  delete sourceData.id;
  delete sourceData._altarData;
  delete sourceData.updatedAt;
  sourceData.name = name;
  sourceData.favorite = false;
  let snapshot = sourceData;
  let createdIds = [];
  let completed = false;
  try {
    if (mode === "fresh") {
      snapshot = window.AltarSaveModes.buildFreshAltarDuplicate(sourceData);
      snapshot.name = name;
      snapshot.favorite = false;
      const materialized = await materializeFreshObjectInstances(snapshot, user);
      snapshot = materialized.snapshot;
      createdIds = materialized.createdIds;
    }
    const saved = await createSavedAltar(snapshot, user);
    completed = true;
    return saved;
  } finally {
    if (!completed && createdIds.length) await rollbackFreshObjectInstances(createdIds, user);
  }
}

async function setSavedAltarFavorite(altarId, favorite) {
  if (!altarId || favoriteUpdatesInFlight.has(altarId)) return false;
  favoriteUpdatesInFlight.add(altarId);
  try {
    const user = await ensureAltarUser();
    const savedAltars = await getSavedAltars();
    const currentUser = await ensureAltarUser();
    if ((user?.id || "guest") !== (currentUser?.id || "guest")) throw new Error("Your account changed before the favorite was saved.");
    const altar = savedAltars.find((item) => item.id === altarId);
    if (!altar) throw new Error("That saved Altar is no longer available.");
    if (!user) {
      const localRows = getLocalSavedAltars();
      const index = localRows.findIndex((item) => item.id === altarId);
      if (index < 0) throw new Error("That guest Altar is no longer available.");
      localRows[index] = { ...localRows[index], favorite: Boolean(favorite), updatedAt: new Date().toISOString() };
      storeLocalSavedAltars(localRows);
    } else {
      const now = new Date().toISOString();
      const altarData = { ...(altar._altarData || {}), favorite: Boolean(favorite) };
      const { data, error } = await db.from(ALTAR_CLOUD_TABLE).update({ altar_data: altarData, updated_at: now }).eq("id", altarId).eq("user_id", user.id).select("id").single();
      if (error || !data) throw error || new Error("Favorite could not be saved.");
    }
    return true;
  } finally {
    favoriteUpdatesInFlight.delete(altarId);
  }
}

function closeSaveDialog(dialog, restoreFocus = true) {
  if (!dialog) return;
  const returnTarget = dialog._returnTarget;
  dialog.remove();
  document.body.classList.remove("altar-save-dialog-open");
  if (restoreFocus) returnTarget?.focus?.();
}

function keepFocusInsideDialog(dialog, event) {
  if (event.key !== "Tab") return;
  const controls = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!controls.length) return;
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function requestAltarName(title, suggestedName, returnTarget) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "altar-save-dialog";
    dialog._returnTarget = returnTarget;
    dialog.innerHTML = `<form class="altar-save-card" role="dialog" aria-modal="true" aria-labelledby="altar-name-title"><p class="eyebrow">Saved Sanctuaries</p><h2 id="altar-name-title">${title}</h2><label for="altar-save-name">Altar name</label><input id="altar-save-name" name="name" maxlength="120" required value=""><p class="altar-save-error" role="alert"></p><div class="altar-save-actions"><button class="button" type="submit">Save</button><button class="button button--ghost" type="button" data-save-cancel>Cancel</button></div></form>`;
    const input = dialog.querySelector("input");
    input.value = suggestedName;
    const finish = (value) => { closeSaveDialog(dialog); resolve(value); };
    dialog.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); const value = input.value.trim(); if (!value) { dialog.querySelector("[role=alert]").textContent = "Enter a name for this Altar."; input.focus(); return; } finish(value); });
    dialog.querySelector("[data-save-cancel]").addEventListener("click", () => finish(null));
    dialog.addEventListener("keydown", (event) => { keepFocusInsideDialog(dialog, event); if (event.key === "Escape") { event.preventDefault(); finish(null); } });
    document.body.appendChild(dialog); document.body.classList.add("altar-save-dialog-open"); input.focus(); input.select();
  });
}

function requestSaveMode(returnTarget) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div"); dialog.className = "altar-save-dialog"; dialog._returnTarget = returnTarget;
    dialog.innerHTML = `<section class="altar-save-card" role="dialog" aria-modal="true" aria-labelledby="altar-save-title"><p class="eyebrow">Saved Sanctuaries</p><h2 id="altar-save-title"></h2><div class="altar-save-choices"><button type="button" data-save-mode="update"><strong>Update Existing Save</strong><span>Replace the current saved arrangement with the Altar as it is now.</span></button><button type="button" data-save-mode="new-view"><strong>Save as New View</strong><span>Create another arrangement using these same living objects and histories.</span></button><button type="button" data-save-mode="fresh"><strong>Duplicate as Fresh Altar</strong><span>Create a separate Altar with fresh object instances and no inherited tending history.</span></button></div><p data-save-status role="status" aria-live="polite"></p><button class="button button--ghost" type="button" data-save-mode="cancel">Cancel</button></section>`;
    dialog.querySelector("h2").textContent = `Save changes to “${activeSavedAltar.savedAltarName}”`;
    const finish = (value) => { closeSaveDialog(dialog); resolve(value); };
    dialog.addEventListener("click", (event) => { const button = event.target.closest("[data-save-mode]"); if (button) finish(button.dataset.saveMode === "cancel" ? null : button.dataset.saveMode); });
    dialog.addEventListener("keydown", (event) => { keepFocusInsideDialog(dialog, event); if (event.key === "Escape") { event.preventDefault(); finish(null); } });
    document.body.appendChild(dialog); document.body.classList.add("altar-save-dialog-open"); dialog.querySelector("[data-save-mode]").focus();
  });
}

function requestDuplicateMode(altar, returnTarget) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "altar-save-dialog";
    dialog._returnTarget = returnTarget;
    dialog.innerHTML = `<section class="altar-save-card" role="dialog" aria-modal="true" aria-labelledby="altar-duplicate-title"><p class="eyebrow">Duplicate saved Altar</p><h2 id="altar-duplicate-title"></h2><p>Choose whether the copy shares these living objects or begins with fresh instances.</p><div class="altar-save-choices"><button type="button" data-duplicate-mode="new-view"><strong>Save as New View</strong><span>Create another saved arrangement with the same living-object identities and histories.</span></button><button type="button" data-duplicate-mode="fresh"><strong>Duplicate as Fresh Altar</strong><span>Create a separate Altar with fresh instances and no inherited candle or tending history.</span></button></div><button class="button button--ghost" type="button" data-duplicate-mode="cancel">Cancel</button></section>`;
    dialog.querySelector("h2").textContent = `Duplicate “${altar.name || "Untitled Altar"}”`;
    const finish = (value) => { closeSaveDialog(dialog); resolve(value); };
    dialog.addEventListener("click", (event) => { const button = event.target.closest("[data-duplicate-mode]"); if (button) finish(button.dataset.duplicateMode === "cancel" ? null : button.dataset.duplicateMode); });
    dialog.addEventListener("keydown", (event) => { keepFocusInsideDialog(dialog, event); if (event.key === "Escape") { event.preventDefault(); finish(null); } });
    document.body.appendChild(dialog);
    document.body.classList.add("altar-save-dialog-open");
    dialog.querySelector("[data-duplicate-mode]").focus();
  });
}

async function duplicateSavedAltarFromLibrary(altarId, trigger) {
  if (!altarId || duplicateAltarsInFlight.has(altarId)) return;
  duplicateAltarsInFlight.add(altarId);
  try {
    const startingUser = await ensureAltarUser();
    const source = (await getSavedAltars()).find((altar) => altar.id === altarId);
    if (!source) throw new Error("That saved Altar is no longer available.");
    const mode = await requestDuplicateMode(source, trigger);
    if (!mode) return;
    const suffix = mode === "new-view" ? " – New View" : " – Fresh Altar";
    const name = await requestAltarName(mode === "new-view" ? "Name the new view" : "Name the fresh Altar", `${source.name || "Untitled Altar"}${suffix}`, trigger);
    if (!name) return;
    const user = await ensureAltarUser();
    if ((startingUser?.id || "guest") !== (user?.id || "guest")) throw new Error("Your account changed. Open My Altars and try again.");
    await duplicateSavedAltar(source, mode, name, user);
    await renderSavedAltarsManager();
    showAltarToast(mode === "new-view" ? `Saved as a new view: “${name}.”` : `Fresh Altar saved: “${name}.”`);
  } catch (error) {
    console.error("Saved Altar duplicate failed:", error?.message || error);
    showAltarToast("The saved Altar could not be duplicated. Please try again.");
  } finally {
    duplicateAltarsInFlight.delete(altarId);
  }
}

async function saveAltar(returnTarget = document.activeElement) {
  if (!altarStage || altarSaveInFlight) return;
  const startingContext = { ...activeSavedAltar };
  let mode = activeSavedAltar.savedAltarId ? await requestSaveMode(returnTarget) : "create";
  if (!mode) return;
  let name = activeSavedAltar.savedAltarName || "My Altar";
  if (mode === "create" || mode === "new-view" || mode === "fresh") {
    const suffix = mode === "new-view" ? " – New View" : mode === "fresh" ? " – Fresh Altar" : "";
    name = await requestAltarName(mode === "fresh" ? "Name the fresh Altar" : "Name this Altar save", `${name}${suffix}`, returnTarget);
    if (!name) return;
  }
  altarSaveInFlight = true;
  let freshInstanceIds = [];
  let saveCompleted = false;
  let persistenceUser = null;
  try {
    const user = await ensureAltarUser();
    persistenceUser = user;
    const ownerScope = user ? "authenticated" : "guest";
    if (startingContext.savedAltarId && (startingContext.ownerScope !== ownerScope || (user && startingContext.ownerId && startingContext.ownerId !== user.id))) throw new Error("Your account changed. Reload the saved Altar before updating it.");
    reconcileCandlesForSave();
    let snapshot = createAltarSnapshot(name);
    if (mode === "fresh") {
      snapshot = window.AltarSaveModes.buildFreshAltarDuplicate(snapshot);
      const materialized = await materializeFreshObjectInstances(snapshot, user);
      snapshot = materialized.snapshot;
      freshInstanceIds = materialized.createdIds;
    }
    const saved = mode === "update" ? await updateSavedAltar(startingContext.savedAltarId, snapshot, user) : await createSavedAltar(snapshot, user);
    saveCompleted = true;
    if (mode === "fresh") restoreAltarData(saved);
    saveWorkingAltarDraft({ immediate: true, snapshot: saved });
    setActiveSavedAltar(saved, { source: mode === "new-view" ? "new-view" : mode === "fresh" ? "fresh-duplicate" : mode === "update" ? startingContext.source : "created", ownerScope, ownerId: user?.id || "", lastSavedAt: saved.updatedAt });
    markAltarClean();
    if (!savedAltarsManager.hidden) await renderSavedAltarsManager();
    showAltarToast(mode === "update" ? `“${saved.name}” has been updated.` : mode === "new-view" ? `Saved as a new view: “${saved.name}.”` : mode === "fresh" ? `Fresh Altar saved: “${saved.name}.”` : `Saved: ${saved.name}`);
  } catch (error) {
    if (!saveCompleted && freshInstanceIds.length) await rollbackFreshObjectInstances(freshInstanceIds, persistenceUser);
    console.error("Altar save failed:", error?.message || error);
    setActiveSavedAltar(startingContext.savedAltarId ? { id: startingContext.savedAltarId, name: startingContext.savedAltarName, savedAt: startingContext.lastSavedAt } : null, startingContext);
    altarContentDirty = true;
    showAltarToast(error?.message || "The Altar could not be saved. Please try again.");
  } finally { altarSaveInFlight = false; }
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
  object.dataset.ritualIncluded = savedObject.ritualIncluded || "false";
  // `dressings` is retained only as an import path for saves made before
  // Living Object State became native storage.
  object.dataset.livingState = savedObject.livingState && typeof savedObject.livingState === "object"
    ? JSON.stringify(savedObject.livingState)
    : savedObject.livingState || "";
  if (!savedObject.livingState && savedObject.dressings) {
    object.dataset.dressings = Array.isArray(savedObject.dressings)
      ? JSON.stringify(savedObject.dressings)
      : savedObject.dressings;
  }
  if (!savedObject.livingState) {
    object.dataset.accumulatedBurnMs = savedObject.accumulatedBurnMs || "";
    object.dataset.currentBurnStartedAt = savedObject.currentBurnStartedAt || savedObject.currentBurn || "";
    object.dataset.lastLitAt = savedObject.lastLitAt || savedObject.lastLit || savedObject.lastBurnedAt || "";
  }
  object.dataset.plaqueText = savedObject.plaqueText || "";
  object.dataset.altarObjectId = savedObject.altarObjectId || "";
  object.dataset.groupId = savedObject.groupId || "";

  if (typeof initializeLivingObjectState === "function") {
    initializeLivingObjectState(object, { preserveUpdatedAt: true });
  }

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

  window.clearTimeout(altarDraftSaveTimeout);
  altarDraftSaveTimeout = null;
  altarDraftDirty = false;
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
  } else {
    altarStage.style.backgroundImage = "";
    altarStage.dataset.background = "";
    altarStage.dataset.backgroundName = "";
  }

  altarGroups = Array.isArray(altarData.groups) ? altarData.groups : [];
  activeGroupId = altarData.activeGroupId || null;
  const restoredObjects = [];

  (altarData.objects || []).forEach((savedObject) => {
    const object = createSavedObject(savedObject);
    restoredObjects.push(object);
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

  const normalizedObjects = (altarData.objects || []).map((savedObject, index) => {
    const {
      dressings,
      accumulatedBurnMs,
      currentBurn,
      currentBurnStartedAt,
      lastBurnedAt,
      lastLit,
      lastLitAt,
      ...canonicalObject
    } = savedObject;
    const object = restoredObjects[index];
    return {
      ...canonicalObject,
      livingState: object?.dataset.livingState || "",
      altarObjectId: object?.dataset.altarObjectId || canonicalObject.altarObjectId || ""
    };
  });

  persistWorkingAltarDraft({ ...altarData, objects: normalizedObjects });
  isRestoringAltarDraft = false;
}

function restoreWorkingAltarDraft() {
  const draft = getWorkingAltarDraft();

  if (!draft || !Array.isArray(draft.objects)) return;

  restoreAltarData(draft);
  const destinationParams = new URLSearchParams(window.location.search);
  const hasSpecificDestination = ["cabinet", "apothecaryItem", "placeCabinetItem", "placeApothecaryItem", "selectObject", "editRitualTemplate"].some((name) => destinationParams.has(name));
  if (!hasSpecificDestination) showAltarToast("Working altar restored");
}

window.addEventListener("pagehide", flushWorkingAltarDraft);
window.addEventListener("beforeunload", flushWorkingAltarDraft);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushWorkingAltarDraft();
});

async function loadAltarById(altarId) {
  if (!altarStage) return;

  const savedAltars = await getSavedAltars();
  const altarData = savedAltars.find((altar) => altar.id === altarId);

  if (!altarData) {
    showAltarToast("Altar not found");
    return;
  }

  restoreAltarData(altarData);
  const user = await ensureAltarUser();
  setActiveSavedAltar(altarData, { source: "loaded", ownerScope: user ? "authenticated" : "guest", ownerId: user?.id || "" });
  markAltarClean();
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

  if (activeSavedAltar.savedAltarId === altarId) activeSavedAltar.savedAltarName = newName.trim();

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


  if (activeSavedAltar.savedAltarId === altarId) setActiveSavedAltar(null);

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

    <div class="saved-altars-library-controls" aria-label="Filter and sort saved Altars">
      <label>Show
        <select data-saved-altars-filter>
          <option value="all">All Altars</option>
          <option value="favorites">Favorites</option>
        </select>
      </label>
      <label>Sort by
        <select data-saved-altars-sort>
          <option value="default">Favorites first</option>
          <option value="newest">Newest created</option>
          <option value="oldest">Oldest created</option>
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
        </select>
      </label>
    </div>

    <div class="saved-altars-list saved-altars-grid" data-saved-altars-list></div>
  </div>
`;

document.body.appendChild(savedAltarsManager);

const savedAltarsList = savedAltarsManager.querySelector("[data-saved-altars-list]");
const savedAltarsClose = savedAltarsManager.querySelector("[data-saved-altars-close]");
const savedAltarsFilterControl = savedAltarsManager.querySelector("[data-saved-altars-filter]");
const savedAltarsSortControl = savedAltarsManager.querySelector("[data-saved-altars-sort]");

function escapeAltarText(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function formatSavedAltarDate(rawDate) {
  const parsed = new Date(rawDate || "");
  if (!Number.isFinite(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString(undefined, {
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
  const allSavedAltars = await getSavedAltars();
  const savedAltars = window.AltarSaveModes.organizeSavedAltars(allSavedAltars, { filter: savedAltarsFilter, sort: savedAltarsSort });

  if (!savedAltarsList) return;

  if (savedAltars.length === 0) {
    savedAltarsList.innerHTML = `
      <div class="saved-altars-empty">
        <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
        <h3>${savedAltarsFilter === "favorites" && allSavedAltars.length ? "No favorite Altars yet." : "No saved altars yet."}</h3>
        <p>
          Build an altar, then use Save to keep it in your Sanctuary.
        </p>
      </div>
    `;
    return;
  }

  savedAltarsList.innerHTML = savedAltars
    .map((altar) => {
      const createdDate = formatSavedAltarDate(altar.savedAt);
      const modifiedDate = formatSavedAltarDate(altar.updatedAt || altar.savedAt);
      const summary = getSavedAltarSummary(altar);
      const backgroundName = escapeAltarText(altar.backgroundName || "Custom altar");
      const name = escapeAltarText(altar.name || "Untitled Altar");
      const id = escapeAltarText(altar.id);
      const favorite = window.AltarSaveModes.isFavorite(altar);
      const active = activeSavedAltar.savedAltarId === altar.id;
      const favoriteLabel = `${favorite ? "Remove" : "Add"} ${altar.name || "Untitled Altar"} ${favorite ? "from" : "to"} favorites`;

      return `
        <article class="saved-altar-row saved-altar-card${favorite ? " is-favorite" : ""}" data-saved-altar-id="${id}">
          <div class="saved-altar-symbol" aria-hidden="true">${favorite ? "★" : "🕯"}</div>

          <div class="saved-altar-body">
            <p class="eyebrow">${backgroundName}</p>
            <h3>${name}${favorite ? '<span class="saved-altar-favorite-marker"><span aria-hidden="true">★</span> Favorite</span>' : ""}</h3>
            ${active ? '<p class="saved-altar-active" role="status">Currently Active</p>' : ""}
            <p>${summary}</p>
            <p class="saved-altar-date">Created: ${createdDate}</p>
            <p class="saved-altar-date">Last modified: ${modifiedDate}</p>
          </div>

          <div class="saved-altar-actions">
            <button type="button" data-saved-action="load">Load</button>
            <button type="button" data-saved-action="rename">Rename</button>
            <button type="button" data-saved-action="delete">Delete</button>
            <button type="button" data-saved-action="duplicate">Duplicate</button>
            <button type="button" data-saved-action="favorite" aria-pressed="${favorite}" aria-label="${escapeAltarText(favoriteLabel)}">${favorite ? "Remove Favorite" : "Add Favorite"}</button>
            <button type="button" disabled aria-disabled="true" title="Sharing is not yet available" aria-label="Share coming soon. Sharing is not yet available.">Share coming soon</button>
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
  setActiveSavedAltar(null);

  deselectObject();
  clearCandleDressingMode();
  updateGroupIndicator();
  updateEmptyMessage();
  saveWorkingAltarDraft({ immediate: true });
}
