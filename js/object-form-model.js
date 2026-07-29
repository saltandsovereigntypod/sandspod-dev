(function initializeObjectFormModel(global) {
  function createForm(data = {}, library = global.Library) {
    const canonicalEntityId = library?.resolveCanonicalEntityId?.(data.entityId);
    if (!canonicalEntityId || !data.id || !data.category || !data.label) return null;
    return { id: String(data.id), category: data.category, label: String(data.label), canonicalEntityId, image: data.image || "", aliases: [...new Set(data.aliases || [])], notes: data.notes || "", dimensions: data.dimensions || null, approximateBurnMinutes: data.category === "candle" ? Number(data.approximateBurnMinutes || 0) || null : null };
  }
  function createInstance(data = {}, form, library = global.Library) {
    if (!form) return null;
    const canonicalEntityId = library?.resolveCanonicalEntityId?.(form.canonicalEntityId);
    if (!canonicalEntityId) return null;
    return { instanceId: data.instanceId || data.id || `instance-${Date.now()}`, canonicalEntityId, formId: form.id, formSnapshot: { label: form.label, image: form.image, category: form.category }, customName: data.customName || "", livingState: data.livingState || {}, position: data.position || null };
  }
  const api = { createForm, createInstance };
  global.ObjectFormModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
