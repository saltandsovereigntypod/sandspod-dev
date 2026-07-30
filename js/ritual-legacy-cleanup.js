(function initializeRitualLegacyCleanup(global) {
  "use strict";

  const CONFIRMATION = "DELETE MY RITUAL TEST DATA";
  const RITUAL_KEYS = Object.freeze([
    "saltAndSovereigntyActiveRitualSession",
    "saltAndSovereigntyRitualLifecycle:guest",
    "saltAndSovereigntyUserRituals"
  ]);
  const LIBRARY_KEY = "saltAndSovereigntyLibrary";

  function isRitualEntity(entity) {
    return entity?.type === "ritual" || entity?.type === "ritual_template" ||
      /^ritual(?:-template)?:/.test(String(entity?.id || ""));
  }

  function previewGuest(storage) {
    const counts = Object.fromEntries(RITUAL_KEYS.map((key) => {
      let count = 0;
      try { const value = JSON.parse(storage.getItem(key)); count = Array.isArray(value) ? value.length : value ? 1 : 0; } catch { count = storage.getItem(key) ? 1 : 0; }
      return [key, count];
    }));
    try {
      const library = JSON.parse(storage.getItem(LIBRARY_KEY)) || {};
      counts.livingLibraryEntities = Object.values(library.entities || {}).filter(isRitualEntity).length;
    } catch { counts.livingLibraryEntities = 0; }
    return counts;
  }

  function clearGuest(storage, confirmation) {
    if (confirmation !== CONFIRMATION) throw new Error("The confirmation phrase did not match.");
    const counts = previewGuest(storage);
    RITUAL_KEYS.forEach((key) => storage.removeItem(key));
    try {
      const library = JSON.parse(storage.getItem(LIBRARY_KEY)) || { entities: {}, relations: [], indexes: {} };
      const removedIds = new Set(Object.values(library.entities || {}).filter(isRitualEntity).map((entity) => entity.id));
      removedIds.forEach((id) => delete library.entities[id]);
      library.relations = (library.relations || []).filter((relation) => !removedIds.has(relation.from) && !removedIds.has(relation.to));
      library.indexes = {};
      Object.values(library.entities || {}).forEach((entity) => { (library.indexes[entity.type] ||= []).push(entity.id); });
      storage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch (error) { console.warn("Guest ritual Library cleanup could not finish.", error); }
    storage.setItem("saltAndSovereigntyRitualCleanupRevision", new Date().toISOString());
    return counts;
  }

  function stableIdentity(entity) {
    const metadata = entity?.metadata || {};
    if (metadata.ritualTemplateId) return `ritual-template:${metadata.ritualTemplateId}`;
    if (metadata.ritualId) return `ritual:${metadata.ritualId}`;
    if (metadata.apothecaryItemId) return `apothecary:${metadata.apothecaryItemId}`;
    if (metadata.traditionalSourceId) return `traditional:${metadata.traditionalSourceId}`;
    if (metadata.canonicalSourceId) return `canonical:${metadata.canonicalSourceId}`;
    return null;
  }

  function auditDuplicates(entities) {
    const stable = new Map(); const names = new Map();
    Object.values(entities || {}).forEach((entity) => {
      const identity = stableIdentity(entity);
      if (identity) (stable.get(identity) || stable.set(identity, []).get(identity)).push(entity);
      const nameKey = `${entity.type || ""}:${String(entity.name || "").trim().toLowerCase()}`;
      if (entity.name) (names.get(nameKey) || names.set(nameKey, []).get(nameKey)).push(entity);
    });
    const safe = [...stable.entries()].filter(([, records]) => records.length > 1).map(([identity, records]) => ({ classification: "safe-automatic-duplicate", identity, ids: records.map((record) => record.id) }));
    const safeIds = new Set(safe.flatMap((group) => group.ids));
    const probable = [...names.entries()].filter(([, records]) => records.length > 1 && records.some((record) => !safeIds.has(record.id))).map(([identity, records]) => ({ classification: "probable-duplicate-requiring-review", identity, ids: records.map((record) => record.id) }));
    return { safe, probable, insufficientEvidence: Object.values(entities || {}).length - new Set([...safe.flatMap((group) => group.ids), ...probable.flatMap((group) => group.ids)]).size };
  }

  global.RitualLegacyCleanup = { CONFIRMATION, RITUAL_KEYS, isRitualEntity, previewGuest, clearGuest, auditDuplicates };
  if (typeof module !== "undefined" && module.exports) module.exports = global.RitualLegacyCleanup;
})(typeof window !== "undefined" ? window : globalThis);
