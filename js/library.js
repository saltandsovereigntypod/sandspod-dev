/* =========================================================
   LIVING LIBRARY
   File: grimoire/js/core/library.js

   Central knowledge graph used by the altar,
   grimoire, apothecary and future systems.
   ========================================================= */

const LIBRARY_STORAGE_KEY = "saltAndSovereigntyLibrary";

const LIBRARY_RELATIONS = {

  PAIRS_WITH: "pairs_with",

  SUBSTITUTES: "substitutes",

  SUBSTITUTE_FOR: "substitute_for",

  INGREDIENT_IN: "ingredient_in",

  CONTAINS: "contains",

  USED_IN: "used_in",

  ASSOCIATED_WITH: "associated_with",

  OFFERED_TO: "offered_to",

  RULED_BY: "ruled_by",

  RELATED_TO: "related_to"

};

const Library = (() => {

  let library = load();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)) || {
        entities: {},
        relations: [],
        indexes: {}
    };
    } catch {
      return {
        entities: {},
        relations: [],
        indexes: {}
    };
    }
  }

function rebuildIndexes() {

    library.indexes = {};

    Object.values(library.entities).forEach(entity => {

        if (!library.indexes[entity.type]) {
            library.indexes[entity.type] = [];
        }

        library.indexes[entity.type].push(entity.id);

    });

}

  function save() {

    rebuildIndexes();

    localStorage.setItem(
        LIBRARY_STORAGE_KEY,
        JSON.stringify(library)
    );

}

function findEntityByNameAndType(name, type) {

    return Object.values(library.entities).find(entity =>
    entity.type === type &&
    entity.name.trim().toLowerCase() === name.trim().toLowerCase()
) || null;

}

function getOrCreateEntity({

    name,
    type,
    image = ""

}) {

    const existing = findEntityByNameAndType(name, type);

    if (existing) {
        return existing;
    }

    return createEntity({

        name,
        type,
        image

    });

}

  function createEntity({
    id,
    type,
    name,
    image = "",
    traditional = {},
    myPractice = {},
    community = {},
    metadata = {},
    aliases = []
  }) {

    id ||= crypto.randomUUID();

    library.entities[id] = {
      id,
      type,
      name,

      aliases,

      image,

      traditional,
      myPractice,
      community,

      metadata,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    save();

    return library.entities[id];
  }

  function updateEntity(id, changes) {

    if (!library.entities[id]) return null;

    Object.assign(
      library.entities[id],
      changes,
      {
        updatedAt: new Date().toISOString()
      }
    );

    save();

    return library.entities[id];
  }

  function updateEntitySection(id, section, changes) {
    if (!library.entities[id]) return null;

    library.entities[id][section] = {
      ...(library.entities[id][section] || {}),
      ...changes
    };

    library.entities[id].updatedAt = new Date().toISOString();

    save();

    return library.entities[id];
  }

function addAlias(id, alias) {

  const entity = library.entities[id];
  if (!entity || !alias) return;

  entity.aliases ??= [];

  if (!entity.aliases.includes(alias)) {
    entity.aliases.push(alias);
  }

  entity.updatedAt = new Date().toISOString();
  save();
}

function removeAlias(id, alias) {

  const entity = library.entities[id];
  if (!entity) return;

  entity.aliases = (entity.aliases || []).filter(a => a !== alias);

  entity.updatedAt = new Date().toISOString();
  save();
}

function findByAlias(alias) {

  alias = alias.trim().toLowerCase();

  return Object.values(library.entities).find(entity =>

    (entity.aliases || []).some(a =>
      a.toLowerCase() === alias
    )

  ) || null;
}

function disconnect(from, relation, to) {

  library.relations = library.relations.filter(link =>

    !(link.from === from &&
      link.relation === relation &&
      link.to === to)

  );

  save();
}

function getRelated(id, relation = null) {

  const links = library.relations.filter(link =>

    relation
      ? (link.from === id && link.relation === relation)
      : (link.from === id)

  );

  return links
    .map(link => getEntity(link.to))
    .filter(Boolean);
}

function replaceConnections(from, relation, targets = []) {

  library.relations = library.relations.filter(link =>

    !(link.from === from &&
      link.relation === relation)

  );

  targets.forEach(target => {

    library.relations.push({

      id: crypto.randomUUID(),

      from,
      relation,
      to: target

    });

  });

  save();
}

function mergeEntities(sourceId, destinationId) {

  if (sourceId === destinationId) return;

  const source = getEntity(sourceId);
  const destination = getEntity(destinationId);

  if (!source || !destination) return;

  destination.aliases = [
    ...(destination.aliases || []),
    source.name,
    ...(source.aliases || [])
  ];

  destination.myPractice = {
    ...destination.myPractice,
    ...source.myPractice
  };

  destination.community = {
    ...destination.community,
    ...source.community
  };

  library.relations.forEach(link => {

    if (link.from === sourceId) link.from = destinationId;
    if (link.to === sourceId) link.to = destinationId;

  });

  removeEntity(sourceId);

  save();
}  

  function getEntity(id) {

    return library.entities[id] || null;

  }

  function getIndex(type) {

        return library.indexes[type] || [];

    }

  function getEntitiesByType(type) {

    return Object.values(library.entities)
      .filter(entity => entity.type === type);

  }

  function getMyPracticeEntitiesByType(type) {
  return Object.values(library.entities)
    .filter((entity) => {
      const hasMyPractice =
        entity.myPractice &&
        Object.keys(entity.myPractice).some((key) => {
          const value = entity.myPractice[key];
          return Array.isArray(value) ? value.length : String(value || "").trim();
        });

      return entity.type === type && hasMyPractice;
    });
}

  function connect(from, relation, to) {

    library.relations.push({
      id: crypto.randomUUID(),
      from,
      relation,
      to
    });

    save();

  }

  function getConnections(id) {

    return library.relations.filter(link =>
      link.from === id ||
      link.to === id
    );

  }

  function updateEntityType(id, newType) {
    if (!library.entities[id]) return null;

    library.entities[id].type = newType;
    library.entities[id].updatedAt = new Date().toISOString();

    save();

    return library.entities[id];
  }

  function updateEntityImage(id, image) {
    if (!library.entities[id]) return null;

    library.entities[id].image = image || "";
    library.entities[id].updatedAt = new Date().toISOString();

    save();

    return library.entities[id];
  }

  function removeEntity(id) {

    delete library.entities[id];

    library.relations =
      library.relations.filter(link =>
        link.from !== id &&
        link.to !== id
      );

    save();

  }

  function exportLibrary() {
    return structuredClone(library);
  }

  function splitConnectionList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEntityName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

function findBestTraditionalEntityMatch(name) {
  const normalizedName = normalizeEntityName(name);

  return Object.values(library.entities).find((entity) => {
    const names = [
      entity.name,
      ...(entity.aliases || [])
    ].map(normalizeEntityName);

    return names.includes(normalizedName);
  }) || null;
}

function connectUnique(from, relation, to) {
  const exists = library.relations.some((link) => {
    return (
      link.from === from &&
      link.relation === relation &&
      link.to === to
    );
  });

  if (exists) return;

  library.relations.push({
    id: crypto.randomUUID(),
    from,
    relation,
    to
  });
}

function importTraditionalLibrary() {
  if (typeof TraditionalLibrary === "undefined") return;

  Object.entries(TraditionalLibrary).forEach(([type, collection]) => {
    Object.entries(collection).forEach(([key, data]) => {
      const entity = getOrCreateEntity({
        name: key.replaceAll("_", " "),
        type
      });

      entity.traditional = structuredClone(data);
      entity.updatedAt = new Date().toISOString();
    });
  });

  Object.entries(TraditionalLibrary).forEach(([type, collection]) => {
    Object.entries(collection).forEach(([key, data]) => {
      const entity = findEntityByNameAndType(key.replaceAll("_", " "), type);
      if (!entity) return;

      if (data.PairsWith) {
        splitConnectionList(data.PairsWith).forEach((name) => {
          const target = findBestTraditionalEntityMatch(name);
          if (!target || target.id === entity.id) return;

          connectUnique(entity.id, LIBRARY_RELATIONS.PAIRS_WITH, target.id);
          connectUnique(target.id, LIBRARY_RELATIONS.PAIRS_WITH, entity.id);
        });
      }

      if (data.Substitutions) {
        splitConnectionList(data.Substitutions).forEach((name) => {
          const target = findBestTraditionalEntityMatch(name);
          if (!target || target.id === entity.id) return;

          connectUnique(entity.id, LIBRARY_RELATIONS.SUBSTITUTES, target.id);
          connectUnique(target.id, LIBRARY_RELATIONS.SUBSTITUTE_FOR, entity.id);
        });
      }
    });
  });

  save();
}

function syncMyPracticeConnections(entityId) {
  const entity = getEntity(entityId);
  if (!entity) return;

  const myPractice = entity.myPractice || {};

  replaceConnections(entity.id, LIBRARY_RELATIONS.PAIRS_WITH, []);
  replaceConnections(entity.id, LIBRARY_RELATIONS.SUBSTITUTES, []);

  if (myPractice.PairsWith) {
    splitConnectionList(myPractice.PairsWith).forEach((name) => {
      const target = findBestTraditionalEntityMatch(name);
      if (!target || target.id === entity.id) return;

      connectUnique(entity.id, LIBRARY_RELATIONS.PAIRS_WITH, target.id);
      connectUnique(target.id, LIBRARY_RELATIONS.PAIRS_WITH, entity.id);
    });
  }

  if (myPractice.Substitutions) {
    splitConnectionList(myPractice.Substitutions).forEach((name) => {
      const target = findBestTraditionalEntityMatch(name);
      if (!target || target.id === entity.id) return;

      connectUnique(entity.id, LIBRARY_RELATIONS.SUBSTITUTES, target.id);
      connectUnique(target.id, LIBRARY_RELATIONS.SUBSTITUTE_FOR, entity.id);
    });
  }

  save();
}

return {

  LIBRARY_RELATIONS,

  createEntity,
  getOrCreateEntity,
  importTraditionalLibrary,
  syncMyPracticeConnections,

  updateEntity,
  updateEntitySection,
  updateEntityType,
  updateEntityImage,

  addAlias,
  removeAlias,
  findByAlias,

  getEntity,
  getEntitiesByType,
  getMyPracticeEntitiesByType,
  getIndex,

  connect,
  disconnect,
  getConnections,
  getRelated,
  replaceConnections,

  mergeEntities,

  removeEntity,

  exportLibrary

};

})();