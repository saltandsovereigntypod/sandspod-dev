/* =========================================================
   LIVING LIBRARY SUPABASE SYNC
   Saves My Practice, images, and layout across devices
   ========================================================= */

const LIVING_LIBRARY_TABLE = "living_library_entries";
const LIVING_LIBRARY_RELATIONS_TABLE = "library_relations";
const LIVING_LIBRARY_LOCAL_MIGRATION_KEY = "saltAndSovereigntyLivingLibraryMigratedToSupabase";

function cleanLivingLibraryImage(image = "") {
  const value = String(image || "");

  if (value.startsWith("data:image/")) {
    return "";
  }

  return value;
}

let livingLibrarySyncReady = false;
let livingLibrarySaveTimers = {};
let livingLibraryHydrating = false;
const livingLibraryLocalRevisions = {};

function getLivingLibraryUser() {
  if (typeof getUser === "function") return getUser();
  if (typeof currentUser !== "undefined") return currentUser;
  return null;
}

function livingLibraryTiming(label, startedAt) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const duration = Math.round((now - startedAt) * 10) / 10;
  console.info(`[Living Library timing] ${label}: ${duration}ms`);
  return now;
}

function getCanonicalMergeKey(userId, sourceId) {
  return `saltAndSovereigntyCanonicalMerge:${userId}:${sourceId}`;
}

function getLivingLibraryLayoutsFromLocal() {
  try {
    return JSON.parse(localStorage.getItem("saltAndSovereigntyLibraryPageLayouts")) || {};
  } catch {
    return {};
  }
}

function getLivingLibraryLayoutForEntity(entityId) {
  if (typeof getLibraryPageLayout === "function") {
    return getLibraryPageLayout(entityId);
  }

  return getLivingLibraryLayoutsFromLocal()[entityId] || {};
}

function hasLivingLibraryUserData(entity) {
  if (!entity) return false;

  return Boolean(
    entity.image ||
    Object.keys(entity.myPractice || {}).length ||
    Object.keys(entity.community || {}).length
  );
}

function getLivingLibraryExportEntities() {
  if (typeof Library === "undefined") return [];

  const exported = Library.exportLibrary?.();
  const entities = exported?.entities || {};

  return Object.values(entities).filter(hasLivingLibraryUserData);
}

async function saveLivingLibraryEntityToSupabase(entityId) {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return { saved: false, localOnly: true };

  const entity = Library.getEntity(entityId);
  if (!entity) return { saved: false, error: "missing_entity" };

  const row = {
    user_id: user.id,
    entity_id: entity.id,
    name: entity.name || "Untitled",
    type: entity.type || "note",
    image: cleanLivingLibraryImage(entity.image) || null,
    my_practice: entity.myPractice || {},
    community: entity.community || {},
    layout: getLivingLibraryLayoutForEntity(entity.id) || {},
    updated_at: new Date().toISOString()
  };

  window.SaltSyncStatus?.saving(user.id);

  const { error } = await db
    .from(LIVING_LIBRARY_TABLE)
    .upsert(row, {
      onConflict: "user_id,entity_id"
    });

  if (error) {
    window.SaltSyncStatus?.failure(user.id);
    console.error("Living Library save failed:", error);
    return { saved: false, error: "cloud_save_failed" };
  }
  window.SaltSyncStatus?.success(user.id);
  return { saved: true };
}

async function flushLivingLibraryEntitySave(entityId) {
  window.clearTimeout(livingLibrarySaveTimers[entityId]);
  delete livingLibrarySaveTimers[entityId];
  return saveLivingLibraryEntityToSupabase(entityId);
}

async function saveLivingLibraryRelationToSupabase(fromEntityId, relation, toEntityId, metadata = {}) {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined") return;
  if (!fromEntityId || !relation || !toEntityId) return;

  const { error } = await db
    .from(LIVING_LIBRARY_RELATIONS_TABLE)
    .upsert(
      {
        user_id: user.id,
        from_entity_id: fromEntityId,
        relation,
        to_entity_id: toEntityId,
        metadata,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,from_entity_id,relation,to_entity_id"
      }
    );

  if (error) {
    console.error("Living Library relation save failed:", error);
  }
}

async function replaceLivingLibraryRelationsInSupabase(fromEntityId, relation, targets = []) {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined") return;
  if (!fromEntityId || !relation) return;

  const { error: deleteError } = await db
    .from(LIVING_LIBRARY_RELATIONS_TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("from_entity_id", fromEntityId)
    .eq("relation", relation);

  if (deleteError) {
    console.error("Living Library relation replace failed:", deleteError);
    return;
  }

  if (!targets.length) return;

  const rows = targets.map((targetId) => ({
    user_id: user.id,
    from_entity_id: fromEntityId,
    relation,
    to_entity_id: targetId,
    metadata: {},
    updated_at: new Date().toISOString()
  }));

  const { error: insertError } = await db
    .from(LIVING_LIBRARY_RELATIONS_TABLE)
    .upsert(rows, {
      onConflict: "user_id,from_entity_id,relation,to_entity_id"
    });

  if (insertError) {
    console.error("Living Library relation replace insert failed:", insertError);
  }
}

async function deleteLivingLibraryRelationFromSupabase(fromEntityId, relation, toEntityId) {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined") return;
  if (!fromEntityId || !relation || !toEntityId) return;

  const { error } = await db
    .from(LIVING_LIBRARY_RELATIONS_TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("from_entity_id", fromEntityId)
    .eq("relation", relation)
    .eq("to_entity_id", toEntityId);

  if (error) {
    console.error("Living Library relation delete failed:", error);
  }
}

async function updateLivingLibraryRelationInSupabase(oldConnection = {}, newConnection = {}) {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined") return;

  if (oldConnection.from && oldConnection.relation && oldConnection.to) {
    await deleteLivingLibraryRelationFromSupabase(
      oldConnection.from,
      oldConnection.relation,
      oldConnection.to
    );
  }

  if (newConnection.from && newConnection.relation && newConnection.to) {
    await saveLivingLibraryRelationToSupabase(
      newConnection.from,
      newConnection.relation,
      newConnection.to
    );
  }
}

function scheduleLivingLibraryEntitySave(entityId) {
  if (!livingLibrarySyncReady || !entityId) return;

  window.clearTimeout(livingLibrarySaveTimers[entityId]);

  livingLibrarySaveTimers[entityId] = window.setTimeout(() => {
    saveLivingLibraryEntityToSupabase(entityId);
  }, 450);
}

async function migrateLocalLivingLibraryToSupabaseOnce() {
  // Explicit Account & Data migration replaces the former sign-in side effect.
  // Hydration may read cloud data, but it must never claim local guest entries.
  return { pending: getLivingLibraryExportEntities().length > 0 };
}

async function loadLivingLibraryFromSupabase() {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const revisionsAtRequest = { ...livingLibraryLocalRevisions };
  const { data, error } = await db
    .from(LIVING_LIBRARY_TABLE)
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error("Living Library load failed:", error);
    return;
  }

  const layouts = getLivingLibraryLayoutsFromLocal();

  livingLibraryHydrating = true;
  try {
    (data || []).forEach((row) => {
      const completedMerge = localStorage.getItem(getCanonicalMergeKey(user.id, row.entity_id));
      if (completedMerge) return;
      if ((livingLibraryLocalRevisions[row.entity_id] || 0) !== (revisionsAtRequest[row.entity_id] || 0)) return;

    let entity = Library.getEntity(row.entity_id);

    if (!entity) {
      entity = Library.createEntity({
        id: row.entity_id,
        name: row.name,
        type: row.type,
        image: row.image || ""
      });
    }

    const existingImage = entity.image || "";
    const incomingImage = row.image || "";

    Library.updateEntity(entity.id, {
      name: row.name || entity.name,
      type: row.type || entity.type,
      image: incomingImage || existingImage,

      myPractice: {
        ...(row.my_practice || {}),
        ...(entity.myPractice || {})
      },

      community: {
        ...(row.community || {}),
        ...(entity.community || {})
      },
      metadata: {
        ...(entity.metadata || {}),
        cloudUpdatedAt: row.updated_at || entity.metadata?.cloudUpdatedAt || null
      }
    });

    if (row.layout && Object.keys(row.layout).length) {
      layouts[entity.id] = {
        ...(row.layout || {}),
        ...(layouts[entity.id] || {})
      };
    }
    });
  } finally {
    livingLibraryHydrating = false;
  }

  localStorage.setItem("saltAndSovereigntyLibraryPageLayouts", JSON.stringify(layouts));
}

window.flushLivingLibraryEntitySave = flushLivingLibraryEntitySave;

async function loadLivingLibraryRelationsFromSupabase() {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const { data, error } = await db
    .from(LIVING_LIBRARY_RELATIONS_TABLE)
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error("Living Library relations load failed:", error);
    return;
  }

  const existingRelations = Library.exportLibrary?.().relations || [];

  (data || []).forEach((row) => {
    const alreadyExists = existingRelations.some((link) => {
      return (
        link.from === row.from_entity_id &&
        link.relation === row.relation &&
        link.to === row.to_entity_id
      );
    });

    if (alreadyExists) return;

    Library.connect(row.from_entity_id, row.relation, row.to_entity_id);
  });
}

function wrapLivingLibraryMethodsForSupabase() {
  if (typeof Library === "undefined") return;
  if (Library.__supabaseWrapped) return;

  Library.__supabaseWrapped = true;

  const originalUpdateEntity = Library.updateEntity?.bind(Library);
  const originalUpdateEntityImage = Library.updateEntityImage?.bind(Library);
  const originalUpdateEntitySection = Library.updateEntitySection?.bind(Library);
  const originalUpdateEntityType = Library.updateEntityType?.bind(Library);

  const originalConnect = Library.connect?.bind(Library);
  const originalDisconnect = Library.disconnect?.bind(Library);
  const originalReplaceConnections = Library.replaceConnections?.bind(Library);

  const originalUpdateConnection =
    typeof Library.updateConnection === "function"
      ? Library.updateConnection.bind(Library)
      : null;

  const originalRemoveConnection =
    typeof Library.removeConnection === "function"
      ? Library.removeConnection.bind(Library)
      : null;

  if (originalUpdateEntity) {
    Library.updateEntity = function(entityId, updates) {
      const result = originalUpdateEntity(entityId, updates);
      if (!livingLibraryHydrating) {
        livingLibraryLocalRevisions[entityId] = (livingLibraryLocalRevisions[entityId] || 0) + 1;
        scheduleLivingLibraryEntitySave(entityId);
      }
      return result;
    };
  }

  if (originalUpdateEntityImage) {
    Library.updateEntityImage = function(entityId, image) {
      const result = originalUpdateEntityImage(entityId, image);
      scheduleLivingLibraryEntitySave(entityId);
      return result;
    };
  }

  if (originalUpdateEntitySection) {
    Library.updateEntitySection = function(entityId, sectionName, value) {
      const result = originalUpdateEntitySection(entityId, sectionName, value);
      scheduleLivingLibraryEntitySave(entityId);
      return result;
    };
  }

  if (originalUpdateEntityType) {
    Library.updateEntityType = function(entityId, type) {
      const result = originalUpdateEntityType(entityId, type);
      scheduleLivingLibraryEntitySave(entityId);
      return result;
    };
  }

  if (originalConnect) {
    Library.connect = function(fromEntityId, relation, toEntityId) {
      const result = originalConnect(fromEntityId, relation, toEntityId);

      if (livingLibrarySyncReady) {
        saveLivingLibraryRelationToSupabase(fromEntityId, relation, toEntityId);
      }

      return result;
    };
  }

  if (originalDisconnect) {
    Library.disconnect = function(fromEntityId, relation, toEntityId) {
      const result = originalDisconnect(fromEntityId, relation, toEntityId);

      if (livingLibrarySyncReady) {
        deleteLivingLibraryRelationFromSupabase(fromEntityId, relation, toEntityId);
      }

      return result;
    };
  }

  if (originalReplaceConnections) {
    Library.replaceConnections = function(fromEntityId, relation, targets = []) {
      const result = originalReplaceConnections(fromEntityId, relation, targets);

      if (livingLibrarySyncReady) {
        replaceLivingLibraryRelationsInSupabase(fromEntityId, relation, targets);
      }

      return result;
    };
  }

  if (originalUpdateConnection) {
    Library.updateConnection = function(connectionId, changes = {}) {
      const before = (Library.exportLibrary?.().relations || []).find((link) => {
        return link.id === connectionId;
      });

      const oldConnection = before
        ? {
            from: before.from,
            relation: before.relation,
            to: before.to
          }
        : {};

      const result = originalUpdateConnection(connectionId, changes);

      const after = (Library.exportLibrary?.().relations || []).find((link) => {
        return link.id === connectionId;
      });

      const newConnection = after
        ? {
            from: after.from,
            relation: after.relation,
            to: after.to
          }
        : {};

      if (livingLibrarySyncReady) {
        updateLivingLibraryRelationInSupabase(oldConnection, newConnection);
      }

      return result;
    };
  }

  if (originalRemoveConnection) {
    Library.removeConnection = function(connectionId) {
      const before = (Library.exportLibrary?.().relations || []).find((link) => {
        return link.id === connectionId;
      });

      const result = originalRemoveConnection(connectionId);

      if (livingLibrarySyncReady && before) {
        deleteLivingLibraryRelationFromSupabase(
          before.from,
          before.relation,
          before.to
        );
      }

      return result;
    };
  }
}


async function saveAllLivingLibraryLayoutsToSupabase() {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const layouts = getLivingLibraryLayoutsFromLocal();

  for (const entityId of Object.keys(layouts)) {
    const entity = Library.getEntity(entityId);
    if (!entity) continue;

    await saveLivingLibraryEntityToSupabase(entityId);
  }
}

async function initLivingLibrarySupabaseSync() {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  wrapLivingLibraryMethodsForSupabase();

  await migrateLocalLivingLibraryToSupabaseOnce();
  let stageStartedAt = livingLibraryTiming("local migration", startedAt);
  await loadLivingLibraryFromSupabase();
  stageStartedAt = livingLibraryTiming("Supabase entity hydration", stageStartedAt);
  await loadLivingLibraryRelationsFromSupabase();
  stageStartedAt = livingLibraryTiming("Supabase relationship hydration", stageStartedAt);

  const canonicalMerges = typeof Library.importTraditionalLibrary === "function"
    ? Library.importTraditionalLibrary() || []
    : [];
  stageStartedAt = livingLibraryTiming("canonical duplicate reconciliation", stageStartedAt);

  if (canonicalMerges.length) {
    const layouts = getLivingLibraryLayoutsFromLocal();
    canonicalMerges.forEach(({ canonicalEntityId, sourceEntityIds }) => {
      sourceEntityIds.forEach((sourceId) => {
        if (!layouts[sourceId]) return;
        layouts[canonicalEntityId] = { ...layouts[sourceId], ...(layouts[canonicalEntityId] || {}) };
        delete layouts[sourceId];
      });
    });
    localStorage.setItem("saltAndSovereigntyLibraryPageLayouts", JSON.stringify(layouts));
  }

  livingLibrarySyncReady = true;

  for (const { canonicalEntityId, sourceEntityIds } of canonicalMerges) {
    const saveResult = await saveLivingLibraryEntityToSupabase(canonicalEntityId);
    if (!saveResult?.saved) continue;
    const connections = Library.getConnections(canonicalEntityId) || [];
    for (const connection of connections) {
      await saveLivingLibraryRelationToSupabase(connection.from, connection.relation, connection.to);
    }
    sourceEntityIds.forEach((sourceId) => {
      localStorage.setItem(getCanonicalMergeKey(user.id, sourceId), canonicalEntityId);
    });
  }
  stageStartedAt = livingLibraryTiming("canonical cloud save", stageStartedAt);

  await saveAllLivingLibraryLayoutsToSupabase();
  livingLibraryTiming("total initialization", startedAt);
  document.dispatchEvent(new CustomEvent("living-library:hydrated", { detail: { canonicalMerges } }));
}

async function deleteLivingLibraryEntityFromSupabase(entityId) {
  const user = getLivingLibraryUser();

  if (!user || !entityId || typeof db === "undefined") return;

  const { error } = await db
    .from(LIVING_LIBRARY_TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("entity_id", entityId);

  if (error) {
    console.error("Living Library delete failed:", error);
  }
}

window.initLivingLibrarySupabaseSync = initLivingLibrarySupabaseSync;
window.saveLivingLibraryEntityToSupabase = saveLivingLibraryEntityToSupabase;
window.deleteLivingLibraryEntityFromSupabase = deleteLivingLibraryEntityFromSupabase;
window.saveLivingLibraryRelationToSupabase = saveLivingLibraryRelationToSupabase;
window.loadLivingLibraryRelationsFromSupabase = loadLivingLibraryRelationsFromSupabase;
