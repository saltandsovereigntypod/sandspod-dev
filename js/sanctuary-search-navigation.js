(function initializeSanctuarySearchNavigation(global) {
  function destinationFor(result, library = global.Library) {
    if (!result) return null;
    if (result.destination) return { ...result.destination };
    if (result.entityId) {
      const entityId = library?.resolveCanonicalEntityId?.(result.entityId);
      return entityId ? { kind: "library-entity", entityId, href: `/grimoire/?entity=${encodeURIComponent(entityId)}` } : null;
    }
    if (result.action?.kind === "apothecary") return { kind: "apothecary-item", itemId: result.action.id, href: `/altar/?apothecaryItem=${encodeURIComponent(result.action.id)}` };
    if (result.href) return { kind: "url", href: result.href };
    return null;
  }
  function open(result, options = {}) {
    const destination = destinationFor(result, options.library);
    if (!destination) return false;
    options.close?.();
    if (destination.kind === "apothecary-item" && typeof options.openApothecary === "function") { options.openApothecary(destination.itemId); return true; }
    if (destination.kind === "current-altar" && typeof options.selectObject === "function") { options.selectObject(destination.instanceId); return true; }
    const navigate = options.navigate || ((href) => { global.location.href = href; });
    if (destination.href) { navigate(destination.href); return true; }
    return false;
  }
  const api = { destinationFor, open };
  global.SanctuarySearchNavigation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
