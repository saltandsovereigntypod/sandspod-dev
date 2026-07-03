/* =========================================================
   LIVING LIBRARY
   File: grimoire/js/core/library.js

   Central knowledge graph used by the altar,
   grimoire, apothecary and future systems.
   ========================================================= */

const LIBRARY_STORAGE_KEY = "saltAndSovereigntyLibrary";

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
    metadata = {}
  }) {

    id ||= crypto.randomUUID();

    library.entities[id] = {
      id,
      type,
      name,
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

  save();
}

  return {

    createEntity,
    getOrCreateEntity,
    importTraditionalLibrary,

    updateEntity,

    updateEntity,
    updateEntitySection,

    getEntity,
    getEntitiesByType,
    getIndex,

    connect,
    getConnections,

    removeEntity,

    exportLibrary

};

})();