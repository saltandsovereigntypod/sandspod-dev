(function initializeApothecaryNormalization(global) {
  const TYPE_LABELS = {
    "spell-jar": "Spell Jar",
    "oil-tincture": "Oil / Tincture",
    "herb-mix": "Herb Mix",
    incense: "Incense",
    sachet: "Sachet",
    poppet: "Poppet",
    spray: "Spray"
  };

  function normalize(record = {}) {
    const details = record.details && typeof record.details === "object" ? record.details : {};
    const type = record.type || record.type_id || record.apothecary_type || details.type || "";
    const rawIngredients = record.ingredients || record.ingredient_list || details.ingredients || [];
    return {
      id: record.id || record.apothecaryItemId || record.apothecary_item_id || record.instance_id || "",
      name: record.name || record.title || record.displayName || record.display_name || record.recipe_name || details.name || "Untitled Apothecary Item",
      type,
      typeLabel: record.typeLabel || record.type_label || record.formLabel || record.form_label || TYPE_LABELS[type] || type.replaceAll("-", " "),
      imagePath: record.imagePath || record.image_url || record.image || details.imagePath || "",
      intention: record.intention || details.intention || "",
      notes: record.notes || record.description || details.notes || "",
      tags: Array.isArray(record.tags) ? record.tags : Array.isArray(details.tags) ? details.tags : [],
      details,
      ingredients: Array.isArray(rawIngredients) ? rawIngredients : [],
      livingState: record.livingState || record.living_state || {},
      linkedEntityIds: record.linkedEntityIds || record.linked_entity_ids || details.linkedEntityIds || [],
      formName: record.formName || record.form_name || details.formName || "",
      entityId: record.entityId || record.entity_id || "",
      instanceId: record.instanceId || record.instance_id || "",
      grimoireEntryId: record.grimoireEntryId || record.grimoire_entry_id || "",
      grimoireStatus: record.grimoireStatus || record.grimoire_status || "",
      logToGrimoire: Boolean(record.logToGrimoire ?? record.log_to_grimoire),
      createdAt: record.createdAt || record.created_at || null,
      updatedAt: record.updatedAt || record.updated_at || record.createdAt || record.created_at || null
    };
  }

  const api = { normalize };
  global.ApothecaryNormalization = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
