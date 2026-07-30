(function initializeLivingConnections(global) {
  const USAGE_EVENT_TYPES = new Set([
    "ritual_use",
    "journal_mention",
    "recipe_ingredient",
    "template_inclusion",
    "object_use",
    "offering"
  ]);

  function unique(values = []) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function resolveEntityId(value, library = global.Library) {
    if (!value) return null;
    if (typeof value === "string") {
      if (!library) return value;
      if (library?.resolveCanonicalEntityId) {
        return library.resolveCanonicalEntityId(value);
      }
      if (value.startsWith("traditional/") && library?.findEntityByTraditionalReference) {
        return library.findEntityByTraditionalReference(value)?.id || null;
      }
      return library?.getEntity?.(value)?.id || null;
    }

    const direct = value.entityId || value.entity_id || value.libraryEntityId || value.library_entity_id;
    if (direct) return resolveEntityId(direct, library);
    const reference = value.traditionalReference || value.metadata?.traditionalReference;
    return reference ? resolveEntityId(reference, library) : null;
  }

  function resolveTimestamp(record = {}) {
    const value = record.timestamp || record.occurred_at || record.occurredAt ||
      record.completed_at || record.completedAt || record.ended_at || record.endedAt ||
      record.created_at || record.createdAt || record.updated_at || record.updatedAt || null;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function createEvent(input = {}) {
    const entityId = resolveEntityId(input.entityId || input.entity_id, input.library);
    const timestamp = resolveTimestamp(input);
    if (!entityId || !input.type || !input.source) return null;

    return {
      id: String(input.id || `${input.source}:${input.type}:${timestamp || "undated"}:${entityId}`),
      timestamp,
      type: String(input.type),
      source: String(input.source),
      entityId,
      relatedEntityIds: unique(input.relatedEntityIds || input.related_entity_ids || []).filter((id) => id !== entityId),
      relatedObjectIds: unique(input.relatedObjectIds || input.related_object_ids || []),
      label: String(input.label || input.type),
      metadata: { ...(input.metadata || {}) }
    };
  }

  function eventIdentity(event) {
    return [event.source, event.id, event.type, event.entityId, event.timestamp || ""].join("|");
  }

  function dedupeEvents(events = []) {
    const seen = new Set();
    return events.filter(Boolean).filter((event) => {
      const key = eventIdentity(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sortEvents(events = [], direction = "asc") {
    const multiplier = direction === "desc" ? -1 : 1;
    return [...events].sort((a, b) => {
      const aTime = a.timestamp ? Date.parse(a.timestamp) : Number.POSITIVE_INFINITY;
      const bTime = b.timestamp ? Date.parse(b.timestamp) : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return (aTime - bTime) * multiplier;
      return eventIdentity(a).localeCompare(eventIdentity(b)) * multiplier;
    });
  }

  function entityIdsFromObjects(objects = []) {
    return unique(objects.map((object) => resolveEntityId(object)));
  }

  function normalizeObjectEvents(entityId, records = []) {
    return records
      .filter((record) => resolveEntityId(record) === entityId)
      .map((record) => createEvent({
        id: record.id,
        timestamp: resolveTimestamp(record),
        type: record.event_type || record.type || "object_activity",
        source: "object_instance",
        entityId,
        relatedObjectIds: [record.instance_id || record.instanceId],
        label: record.event_label || record.label || record.event_type || "Object activity",
        metadata: {
          ...(record.metadata || {}),
          notes: record.event_notes || record.notes || "",
          countsAsUse: record.metadata?.countsAsUse || record.event_type === "used"
        }
      }));
  }

  function normalizeLivingStates(entityId, records = []) {
    const events = [];
    records.filter((record) => resolveEntityId(record) === entityId).forEach((record) => {
      const state = record.state || record.livingState || {};
      const objectId = record.objectId || record.object_id || record.instanceId || null;
      (state.candle?.burnHistory || []).forEach((burn, index) => events.push(createEvent({
        id: burn.id || `burn:${objectId || entityId}:${burn.endedAt || index}`,
        timestamp: burn.endedAt || burn.startedAt,
        type: "object_use",
        source: "living_object_state",
        entityId,
        relatedObjectIds: [objectId],
        label: "Candle burned",
        metadata: { ...burn, countsAsUse: true }
      })));
      (state.crystal?.cleansingHistory || []).forEach((care, index) => events.push(createEvent({
        id: care.id || `cleanse:${objectId || entityId}:${care.occurredAt || index}`,
        timestamp: care.occurredAt || care.completedAt,
        type: "cleansed",
        source: "living_object_state",
        entityId,
        relatedEntityIds: care.supports?.map((support) => resolveEntityId(support)) || [],
        relatedObjectIds: [objectId],
        label: care.label || "Crystal cleansed",
        metadata: { ...care }
      })));
      (state.crystal?.chargingHistory || []).forEach((care, index) => events.push(createEvent({
        id: care.id || `charge:${objectId || entityId}:${care.occurredAt || index}`,
        timestamp: care.occurredAt || care.completedAt,
        type: "charged",
        source: "living_object_state",
        entityId,
        relatedEntityIds: care.supports?.map((support) => resolveEntityId(support)) || [],
        relatedObjectIds: [objectId],
        label: care.label || "Crystal charged",
        metadata: { ...care }
      })));
      if (state.crystal?.dedicationDetails?.recordedAt) events.push(createEvent({
        id: `dedication:${objectId || entityId}:${state.crystal.dedicationDetails.recordedAt}`,
        timestamp: state.crystal.dedicationDetails.recordedAt,
        type: "dedicated",
        source: "living_object_state",
        entityId,
        relatedEntityIds: [state.crystal.dedicationDetails.entityId],
        relatedObjectIds: [objectId],
        label: "Crystal dedicated",
        metadata: { ...state.crystal.dedicationDetails }
      }));
      (state.deity?.offerings || []).forEach((offering, index) => events.push(createEvent({
        id: offering.id || `offering:${objectId || entityId}:${offering.occurredAt || index}`,
        timestamp: offering.occurredAt || offering.completedAt,
        type: "offering",
        source: "living_object_state",
        entityId,
        relatedEntityIds: offering.items?.map((item) => resolveEntityId(item)) || [],
        relatedObjectIds: [objectId, ...(offering.items || []).map((item) => item.objectId || item.id)],
        label: offering.label || "Offering recorded",
        metadata: { ...offering, countsAsUse: true }
      })));
    });
    return events;
  }

  function normalizeRituals(entityId, rituals = [], ritualLinks = []) {
    const linksByRitual = new Map();
    ritualLinks.forEach((link) => {
      const ritualId = String(link.ritual_id || link.ritualId || "");
      if (!ritualId) return;
      if (!linksByRitual.has(ritualId)) linksByRitual.set(ritualId, []);
      linksByRitual.get(ritualId).push(link);
    });

    const ritualsById = new Map(rituals.map((ritual) => [String(ritual.id), ritual]));
    const ritualIds = new Set([...ritualsById.keys(), ...linksByRitual.keys()]);
    const events = [];

    ritualIds.forEach((ritualId) => {
      const ritual = ritualsById.get(ritualId) || {};
      const links = linksByRitual.get(ritualId) || [];
      const snapshotObjects = ritual.altar_snapshot?.objects || ritual.altarSnapshot?.objects || [];
      const linkedEntityIds = links.map((link) => resolveEntityId(link));
      const relatedEntityIds = unique([...entityIdsFromObjects(snapshotObjects), ...linkedEntityIds]);
      if (!relatedEntityIds.includes(entityId)) return;

      events.push(createEvent({
        id: `ritual:${ritualId}`,
        timestamp: ritual.ended_at || ritual.completed_at || ritual.ritual_date || ritual.created_at,
        type: "ritual_use",
        source: "ritual",
        entityId,
        relatedEntityIds,
        relatedObjectIds: snapshotObjects.map((object) => object.instanceId || object.instance_id),
        label: ritual.title || links.find((link) => link.label)?.label || "Ritual",
        metadata: {
          ritualId,
          templateId: ritual.template_id || null,
          ritualType: ritual.source || ritual.type || (ritual.template_id ? "template" : "free"),
          grimoirePageId: ritual.grimoire_page_id || links.find((link) => link.grimoire_page_id)?.grimoire_page_id || null,
          countsAsUse: true
        }
      }));
    });

    return events;
  }

  function normalizeTemplates(entityId, templates = []) {
    return templates.flatMap((template) => {
      const steps = template.ritual_template_steps || template.steps || [];
      const linked = unique(steps.flatMap((step) => step.linked_entities || step.linkedEntities || []).map((value) => resolveEntityId(value)));
      if (!linked.includes(entityId)) return [];
      return [createEvent({
        id: `template:${template.id}`,
        timestamp: template.updated_at || template.created_at,
        type: "template_inclusion",
        source: "ritual_template",
        entityId,
        relatedEntityIds: linked,
        label: template.title || "Ritual template",
        metadata: { templateId: template.id, referenceType: "template", countsAsUse: false }
      })];
    });
  }

  function normalizeRecipes(entityId, recipes = []) {
    return recipes.flatMap((recipe) => {
      const ingredients = recipe.ingredients || [];
      const ingredientIds = unique(ingredients.map((value) => resolveEntityId(value)));
      if (!ingredientIds.includes(entityId)) return [];
      const recipeEntityId = resolveEntityId(recipe);
      return [createEvent({
        id: `recipe:${recipe.id || recipeEntityId}`,
        timestamp: recipe.created_at || recipe.createdAt || recipe.updated_at || recipe.updatedAt,
        type: "recipe_ingredient",
        source: "apothecary",
        entityId,
        relatedEntityIds: [...ingredientIds, recipeEntityId],
        relatedObjectIds: [recipe.instance_id || recipe.instanceId],
        label: recipe.name || "Apothecary recipe",
        metadata: { recipeId: recipe.id || null, recipeType: recipe.type || null, countsAsUse: true }
      })];
    });
  }

  function normalizePages(entityId, pages = [], pageLinks = []) {
    const events = [];
    pages.forEach((page) => {
      const metadataIds = unique([
        ...(page.metadata?.entityIds || []),
        page.metadata?.entityId,
        page.entity_id
      ]);
      if (!metadataIds.includes(entityId)) return;
      events.push(createEvent({
        id: `page:${page.id}`,
        timestamp: page.updated_at || page.created_at,
        type: "journal_mention",
        source: "grimoire_page",
        entityId,
        relatedEntityIds: metadataIds,
        label: page.title || "Book of Shadows page",
        metadata: { pageId: page.id, pageType: page.page_type || null, countsAsUse: true }
      }));
    });

    pageLinks.forEach((link) => {
      if (resolveEntityId(link) !== entityId) return;
      events.push(createEvent({
        id: `page-link:${link.id}`,
        timestamp: link.created_at,
        type: "journal_mention",
        source: "grimoire_page_link",
        entityId,
        label: link.label || "Book of Shadows reference",
        metadata: {
          pageId: link.source_page_id || link.page_id || null,
          targetPageId: link.target_page_id || null,
          countsAsUse: true
        }
      }));
    });
    return events;
  }

  function normalizeEntityCreated(entityId, library) {
    const entity = library?.getEntity?.(entityId);
    if (!entity) return [];
    return [createEvent({
      id: `entity:${entity.id}:created`,
      timestamp: entity.createdAt,
      type: "added",
      source: "living_library",
      entityId,
      label: entity.name || "Living Library entity",
      metadata: { entityType: entity.type || null }
    })];
  }

  function getTimeline(entity, sources = {}, options = {}) {
    const library = sources.library || global.Library;
    const entityId = resolveEntityId(entity, library);
    if (!entityId) return [];
    if (Array.isArray(sources.timeline)) {
      return sortEvents(
        dedupeEvents(sources.timeline.filter((event) => event.entityId === entityId)),
        options.direction || "asc"
      );
    }
    const events = [
      ...normalizeEntityCreated(entityId, library),
      ...normalizeObjectEvents(entityId, sources.objectEvents || []),
      ...normalizeLivingStates(entityId, sources.livingStates || []),
      ...normalizeRituals(entityId, sources.rituals || [], sources.ritualLinks || []),
      ...normalizeTemplates(entityId, sources.templates || []),
      ...normalizeRecipes(entityId, sources.apothecaryItems || sources.recipes || []),
      ...normalizePages(entityId, sources.grimoirePages || [], sources.pageLinks || []),
      ...(sources.events || []).map((event) => createEvent({ ...event, entityId: event.entityId || entityId }))
    ];
    return sortEvents(dedupeEvents(events), options.direction || "asc");
  }

  function getUsage(entity, sources = {}) {
    const events = getTimeline(entity, sources).filter((event) => {
      return event.metadata.countsAsUse === true || USAGE_EVENT_TYPES.has(event.type);
    });
    return {
      firstUse: events[0] || null,
      lastUse: events[events.length - 1] || null,
      mostRecentUse: events[events.length - 1] || null,
      totalUses: events.length,
      uses: events
    };
  }

  function getPairings(entity, sources = {}, options = {}) {
    const library = sources.library || global.Library;
    const entityId = resolveEntityId(entity, library);
    if (!entityId) return [];
    const counts = new Map();

    getUsage(entityId, sources).uses.forEach((event) => {
      event.relatedEntityIds.forEach((relatedId) => {
        if (relatedId === entityId) return;
        const current = counts.get(relatedId) || { entityId: relatedId, frequency: 0, eventIds: [] };
        current.frequency += 1;
        current.eventIds.push(event.id);
        counts.set(relatedId, current);
      });
    });

    const explicitRelations = library?.getConnections?.(entityId) || [];
    explicitRelations.forEach((relation) => {
      const relatedId = relation.from === entityId ? relation.to : relation.from;
      const current = counts.get(relatedId) || { entityId: relatedId, frequency: 0, eventIds: [] };
      current.relations = unique([...(current.relations || []), relation.relation]);
      counts.set(relatedId, current);
    });

    return [...counts.values()]
      .map((pairing) => ({ ...pairing, entity: library?.getEntity?.(pairing.entityId) || null }))
      .filter((pairing) => !options.type || pairing.entity?.type === options.type)
      .sort((a, b) => b.frequency - a.frequency || String(a.entity?.name || a.entityId).localeCompare(String(b.entity?.name || b.entityId)));
  }

  function getPairingFrequency(entity, relatedEntity, sources = {}) {
    const library = sources.library || global.Library;
    const relatedEntityId = resolveEntityId(relatedEntity, library);
    return getPairings(entity, sources).find((pairing) => pairing.entityId === relatedEntityId)?.frequency || 0;
  }

  function getObjectPairings(entity, sources = {}) {
    const counts = new Map();
    getUsage(entity, sources).uses.forEach((event) => {
      event.relatedObjectIds.forEach((objectId) => {
        const current = counts.get(objectId) || { objectId, frequency: 0, eventIds: [] };
        current.frequency += 1;
        current.eventIds.push(event.id);
        counts.set(objectId, current);
      });
    });
    return [...counts.values()].sort((a, b) => b.frequency - a.frequency || a.objectId.localeCompare(b.objectId));
  }

  function getRitualTypeFrequency(entity, sources = {}) {
    const counts = new Map();
    getUsage(entity, sources).uses
      .filter((event) => event.source === "ritual")
      .forEach((event) => {
        const ritualType = String(event.metadata.ritualType || "ritual");
        counts.set(ritualType, (counts.get(ritualType) || 0) + 1);
      });
    return [...counts.entries()]
      .map(([ritualType, frequency]) => ({ ritualType, frequency }))
      .sort((a, b) => b.frequency - a.frequency || a.ritualType.localeCompare(b.ritualType));
  }

  function getReferences(entity, sources = {}) {
    const library = sources.library || global.Library;
    const entityId = resolveEntityId(entity, library);
    const record = library?.getEntity?.(entityId);
    if (!entityId) return null;
    const timeline = getTimeline(entityId, sources);
    const bySource = (source) => timeline.filter((event) => event.source === source);
    const traditionalReference = record?.metadata?.traditionalReference ?? null;
    const traditionalFields = Object.keys(record?.traditional || {});
    const myPracticeFields = Object.keys(record?.myPractice || {});
    const communityFields = Object.keys(record?.community || {});
    const relationships = library?.getConnections?.(entityId) || [];
    const relatedEntities = relationships.map((relationship) => {
      const relatedEntityId = relationship.from === entityId ? relationship.to : relationship.from;
      const relatedEntity = library?.getEntity?.(relatedEntityId);
      if (!relatedEntity) return null;
      return {
        entityId: relatedEntity.id,
        label: relatedEntity.name || "Untitled",
        entityType: relatedEntity.type || "entry",
        relation: relationship.relation,
        direction: relationship.from === entityId ? "outgoing" : "incoming"
      };
    }).filter(Boolean);
    const ritualPages = timeline
      .filter((event) => event.metadata.grimoirePageId)
      .map((event) => ({
        id: `${event.id}:page`,
        label: event.label,
        timestamp: event.timestamp,
        metadata: {
          pageId: event.metadata.grimoirePageId,
          ritualId: event.metadata.ritualId,
          sourceEventId: event.id
        }
      }));
    const pageEvents = timeline.filter((event) => event.source.startsWith("grimoire_"));
    return {
      entityId,
      relationships,
      relatedEntities,
      journals: timeline.filter((event) => event.type === "journal_mention" || (event.type === "ritual_use" && event.metadata.grimoirePageId)),
      rituals: timeline.filter((event) => event.type === "ritual_use"),
      templates: bySource("ritual_template"),
      recipes: bySource("apothecary"),
      bookOfShadowsPages: [...pageEvents, ...ritualPages],
      objectActivity: bySource("object_instance"),
      relatedObjects: getObjectPairings(entityId, sources),
      traditionalReferences: traditionalFields.length ? [{ entityId, traditionalReference, fields: traditionalFields }] : [],
      myPracticeReferences: myPracticeFields.length ? [{ entityId, fields: myPracticeFields }] : [],
      communityReferences: communityFields.length ? [{ entityId, fields: communityFields }] : [],
      layers: {
        traditional: Boolean(traditionalFields.length),
        myPractice: Boolean(myPracticeFields.length),
        community: Boolean(communityFields.length)
      },
      traditionalReference
    };
  }

  async function load(entity, options = {}) {
    const library = options.library || global.Library;
    const entityId = resolveEntityId(entity, library);
    if (!entityId) return { entityId: null, timeline: [], usage: getUsage(null), pairings: [], references: null };

    const sources = { ...(options.sources || {}), library };
    const canonicalEntity = library?.getEntity?.(entityId);
    const equivalentEntityIds = unique([entityId, ...(canonicalEntity?.metadata?.mergedEntityIds || [])]);
    if (!sources.livingStates && typeof document !== "undefined" && typeof global.getLivingObjectState === "function") {
      sources.livingStates = [...document.querySelectorAll(".altar-object[data-entity-id]")]
        .filter((object) => object.dataset.entityId === entityId)
        .map((object) => ({
          entityId,
          objectId: object.dataset.altarObjectId || object.dataset.instanceId || "",
          state: global.getLivingObjectState(object)
        }));
    }
    if (!sources.objectEvents && typeof global.getObjectInstanceEventsByEntity === "function") {
      const eventGroups = await Promise.all(equivalentEntityIds.map((id) => global.getObjectInstanceEventsByEntity(id)));
      sources.objectEvents = eventGroups.flat().map((event) => ({
        ...event,
        entity_id: entityId,
        metadata: { ...(event.metadata || {}), legacyEntityId: event.entity_id || event.entityId || null }
      }));
    }

    const database = options.db || (typeof db !== "undefined" ? db : global.db);
    const user = options.user || (typeof global.getUser === "function" ? global.getUser() : global.currentUser);
    if (database && user && !sources.ritualLinks) {
      const linkResult = await database.from("ritual_links").select("*").eq("user_id", user.id).in("entity_id", equivalentEntityIds);
      if (!linkResult.error) {
        const targetLinks = linkResult.data || [];
        const ritualIds = unique(targetLinks.map((link) => link.ritual_id));
        sources.ritualLinks = targetLinks;
        if (ritualIds.length) {
          const allLinks = await database.from("ritual_links").select("*").eq("user_id", user.id).in("ritual_id", ritualIds);
          if (!allLinks.error) sources.ritualLinks = allLinks.data || targetLinks;
          if (!sources.rituals) {
            const rituals = await database.from("user_rituals").select("*").eq("user_id", user.id).in("id", ritualIds);
            if (!rituals.error) sources.rituals = rituals.data || [];
          }
        }
      }
    }

    const timeline = getTimeline(entityId, sources);
    const computedSources = { ...sources, timeline };
    return {
      entityId,
      entity: library?.getEntity?.(entityId) || null,
      timeline,
      usage: getUsage(entityId, computedSources),
      pairings: getPairings(entityId, computedSources),
      references: getReferences(entityId, computedSources),
      objectPairings: getObjectPairings(entityId, computedSources),
      ritualTypes: getRitualTypeFrequency(entityId, computedSources),
      sources
    };
  }

  const api = {
    resolveEntityId,
    resolveTimestamp,
    createEvent,
    dedupeEvents,
    sortEvents,
    getTimeline,
    getUsage,
    getPairings,
    getPairingFrequency,
    getObjectPairings,
    getRitualTypeFrequency,
    getReferences,
    load
  };

  global.LivingConnections = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
