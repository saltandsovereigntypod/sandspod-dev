/* =========================================================
   LIVING LIBRARY SUPABASE SYNC
   Saves My Practice, images, and layout across devices
   ========================================================= */

const LIVING_LIBRARY_TABLE = "living_library_entries";
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

function getLivingLibraryUser() {
  if (typeof getUser === "function") return getUser();
  if (typeof currentUser !== "undefined") return currentUser;
  return null;
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

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const entity = Library.getEntity(entityId);
  if (!entity) return;

  const row = {
    user_id: user.id,
    entity_id: entity.id,
    name: entity.name || "Untitled",
    type: entity.type || "note",
    image: entity.image || null,
    my_practice: entity.myPractice || {},
    community: entity.community || {},
    layout: getLivingLibraryLayoutForEntity(entity.id) || {},
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from(LIVING_LIBRARY_TABLE)
    .upsert(row, {
      onConflict: "user_id,entity_id"
    });

  if (error) {
    console.error("Living Library save failed:", error);
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
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const migrationKey = `${LIVING_LIBRARY_LOCAL_MIGRATION_KEY}:${user.id}`;

  if (localStorage.getItem(migrationKey) === "true") return;

  const entities = getLivingLibraryExportEntities();

  if (!entities.length) {
    localStorage.setItem(migrationKey, "true");
    return;
  }

  const rows = entities.map((entity) => ({
    user_id: user.id,
    entity_id: entity.id,
    name: entity.name || "Untitled",
    type: entity.type || "note",
    image: entity.image || null,
    my_practice: entity.myPractice || {},
    community: entity.community || {},
    layout: getLivingLibraryLayoutForEntity(entity.id) || {},
    updated_at: new Date().toISOString()
  }));

  const { error } = await db
    .from(LIVING_LIBRARY_TABLE)
    .upsert(rows, {
      onConflict: "user_id,entity_id"
    });

  if (error) {
    console.error("Living Library migration failed:", error);
    return;
  }

  localStorage.setItem(migrationKey, "true");
}

async function loadLivingLibraryFromSupabase() {
  const user = getLivingLibraryUser();

  if (!user || typeof db === "undefined" || typeof Library === "undefined") return;

  const { data, error } = await db
    .from(LIVING_LIBRARY_TABLE)
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error("Living Library load failed:", error);
    return;
  }

  const layouts = getLivingLibraryLayoutsFromLocal();

  (data || []).forEach((row) => {
    let entity = Library.getEntity(row.entity_id);

    if (!entity) {
      entity = Library.getOrCreateEntity({
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
      }
    });

    if (row.layout && Object.keys(row.layout).length) {
      layouts[entity.id] = {
        ...(row.layout || {}),
        ...(layouts[entity.id] || {})
      };
    }
  });

  localStorage.setItem("saltAndSovereigntyLibraryPageLayouts", JSON.stringify(layouts));
}

function wrapLivingLibraryMethodsForSupabase() {
  if (typeof Library === "undefined") return;
  if (Library.__supabaseWrapped) return;

  Library.__supabaseWrapped = true;

  const originalUpdateEntity = Library.updateEntity?.bind(Library);
  const originalUpdateEntityImage = Library.updateEntityImage?.bind(Library);
  const originalUpdateEntitySection = Library.updateEntitySection?.bind(Library);
  const originalUpdateEntityType = Library.updateEntityType?.bind(Library);

  if (originalUpdateEntity) {
    Library.updateEntity = function(entityId, updates) {
      const result = originalUpdateEntity(entityId, updates);
      scheduleLivingLibraryEntitySave(entityId);
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

  wrapLivingLibraryMethodsForSupabase();

  await migrateLocalLivingLibraryToSupabaseOnce();
  await loadLivingLibraryFromSupabase();

  livingLibrarySyncReady = true;

  await saveAllLivingLibraryLayoutsToSupabase();
}

window.initLivingLibrarySupabaseSync = initLivingLibrarySupabaseSync;
window.saveLivingLibraryEntityToSupabase = saveLivingLibraryEntityToSupabase;