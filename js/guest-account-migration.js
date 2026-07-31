(function initializeGuestAccountMigration(global) {
  "use strict";

  const GUEST_SCOPE_KEY = "saltAndSovereigntyGuestScope";
  const DISMISS_PREFIX = "saltAndSovereigntyGuestMigrationDismissed";
  const CHECKPOINT_PREFIX = "saltAndSovereigntyGuestMigration";
  const CATEGORIES = Object.freeze([
    { id: "settings", label: "Settings and preferences", sections: ["settings", "mundaneMode"] },
    { id: "altars", label: "Digital Altar", sections: ["altars"] },
    { id: "grimoire", label: "Book of Shadows", sections: [] },
    { id: "livingLibrary", label: "Living Library", sections: ["livingLibrary", "livingLibraryLayouts"] },
    { id: "apothecary", label: "Apothecary", sections: ["apothecary"] },
    { id: "rituals", label: "Rituals and templates", sections: ["ritualJournals", "ritualLifecycle"] },
    { id: "custom", label: "Custom images and Cabinet items", sections: ["customCabinet"] }
  ]);
  const STAGE_ORDER = Object.freeze(["user_settings", "living_library_entries", "ritual_templates", "ritual_template_steps", "ritual_sessions", "ritual_session_steps", "user_rituals", "apothecary_items", "saved_altars", "custom_cabinet_items", "library_relations"]);
  const TABLE_KEYS = Object.freeze({ user_settings: "user_id", living_library_entries: "entity_id", library_relations: null, saved_altars: "id", apothecary_items: "id", custom_cabinet_items: "id", ritual_templates: "id", ritual_template_steps: "id", ritual_sessions: "id", ritual_session_steps: "id", user_rituals: "id" });
  const UUID_ID_TABLES = new Set(["saved_altars", "apothecary_items", "custom_cabinet_items", "ritual_templates", "ritual_template_steps", "ritual_sessions", "ritual_session_steps", "user_rituals"]);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return value !== null && value !== undefined && value !== "" && value !== false;
  }

  function readGuestRaw(storage) {
    const preserved = storage.getItem(global.SaltAccountData?.PENDING_GUEST_SNAPSHOT_KEY || "saltAndSovereigntyPendingGuestMigrationSnapshot");
    if (preserved) { try { return JSON.parse(preserved); } catch {} }
    const data = {};
    for (const [section, key] of Object.entries(global.SanctuaryBackup.GUEST_KEYS)) {
      const raw = storage.getItem(key); if (raw == null) continue;
      try { data[section] = JSON.parse(raw); } catch { data[section] = raw; }
    }
    return data;
  }

  function readGuestData(storage) {
    return global.SanctuaryBackup.sanitize(readGuestRaw(storage));
  }

  function hasGuestData(storage) {
    const data = readGuestData(storage);
    const marked = storage.getItem(GUEST_SCOPE_KEY) === "true" || storage.getItem("saltAndSovereigntySanctuaryChoice") === "true";
    const strongSections = ["altars", "altarDraft", "apothecary", "ritualJournals", "ritualLifecycle", "customCabinet"];
    return Boolean((marked && Object.values(data).some(hasValue)) || strongSections.some((section) => hasValue(data[section])));
  }

  async function sourceDigest(data) {
    return global.SanctuaryBackup.sha256(global.SanctuaryBackup.stableStringify(global.SanctuaryBackup.sanitize(data)));
  }

  function snapshotFingerprint(data) {
    const text = global.SanctuaryBackup.stableStringify(global.SanctuaryBackup.sanitize(data));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return `${text.length}-${(hash >>> 0).toString(16)}`;
  }

  function currentFingerprint(storage) { return snapshotFingerprint(readGuestData(storage)); }

  function isPersonalEntity(entity) { return Boolean(entity?.image || Object.keys(entity?.myPractice || {}).length || Object.keys(entity?.community || {}).length || entity?.metadata?.custom || entity?.metadata?.ritualId || entity?.metadata?.ritualTemplateId); }
  function countLibrary(value) { return Object.values(value?.entities || {}).filter(isPersonalEntity).length; }
  function countRituals(value, journals) { return (Array.isArray(journals) ? journals.length : 0) + (Array.isArray(value?.sessions) ? value.sessions.length : 0); }
  function countAssets(data) { return global.SanctuaryBackup.findAssetReferences(data).filter((url) => /^data:image\//i.test(url)).length; }

  async function createPreview(storage) {
    const raw = readGuestRaw(storage); const securityErrors = [];
    global.SanctuaryBackup.scanForbidden(raw, securityErrors, "guest");
    const blockingSecurityErrors = securityErrors.filter((message) => !/\.(?:user_id|owner_id|created_by)$/.test(message));
    if (blockingSecurityErrors.length) throw new Error("Guest data contains fields that cannot be migrated safely.");
    const data = global.SanctuaryBackup.sanitize(raw);
    const digest = await sourceDigest(data);
    const counts = {
      settings: hasValue(data.settings) || hasValue(data.mundaneMode) ? 1 : 0,
      altars: Array.isArray(data.altars) ? data.altars.length : 0,
      grimoire: 0,
      livingLibrary: countLibrary(data.livingLibrary),
      apothecary: Array.isArray(data.apothecary) ? data.apothecary.length : 0,
      rituals: countRituals(data.ritualLifecycle, data.ritualJournals),
      custom: Array.isArray(data.customCabinet) ? data.customCabinet.length : 0,
      assets: countAssets(data)
    };
    const unsupported = [];
    if (hasValue(data.altarDraft)) unsupported.push("The working Altar draft remains local; migrate a named saved Altar instead.");
    if (counts.grimoire === 0) unsupported.push("This version has no independently restorable guest Book of Shadows table records to migrate.");
    if (counts.assets) unsupported.push(`${counts.assets} browser-embedded image${counts.assets === 1 ? "" : "s"} require manual review and are not uploaded automatically.`);
    return Object.freeze({ digest, fingerprint: snapshotFingerprint(data), data, counts, unsupported, categories: CATEGORIES.map((category) => ({ ...category, selected: category.id !== "grimoire" && counts[category.id] > 0, supported: category.id !== "grimoire" })) });
  }

  async function createSafetyBackup(preview, options = {}) {
    const assets = await global.SanctuaryBackup.collectAssets(preview.data, { fetch: options.fetch });
    return global.SanctuaryBackup.createBackup(preview.data, { scope: "guest-browser", environment: global.SaltEnvironment?.name || "unknown", assets: assets.assets, warnings: [...assets.warnings, ...preview.unsupported], complete: true });
  }
  async function isPreviewCurrent(storage, preview) { return sourceDigest(readGuestData(storage)).then((digest) => digest === preview.digest); }

  async function deterministicUuid(namespace, id) {
    const hex = (await global.SanctuaryBackup.sha256(`${namespace}:${id}`)).slice(0, 32).split("");
    hex[12] = "4"; hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
    return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
  }

  function stripBrowserAssets(value, warnings, path = "record") {
    if (Array.isArray(value)) return value.map((item, index) => stripBrowserAssets(item, warnings, `${path}[${index}]`));
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && (/^data:image\//i.test(value) || /^blob:/i.test(value))) { warnings.push(`A browser-only image was omitted at ${path}.`); return ""; }
      return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, stripBrowserAssets(child, warnings, `${path}.${key}`)]));
  }

  function libraryRows(library, userId, warnings) {
    const entities = Object.values(library?.entities || {}).filter(isPersonalEntity).map((entity) => ({ user_id: userId, entity_id: entity.id, name: entity.name || "Untitled", type: entity.type || "note", image: /^https?:\/\//i.test(entity.image || "") ? entity.image : null, my_practice: stripBrowserAssets(entity.myPractice || {}, warnings), community: stripBrowserAssets(entity.community || {}, warnings), layout: {} }));
    const migratedIds = new Set(entities.map((entity) => entity.entity_id));
    const relations = (library?.relations || []).filter((relation) => relation.from && relation.to && relation.relation && (migratedIds.has(relation.from) || migratedIds.has(relation.to))).map((relation) => ({ user_id: userId, from_entity_id: relation.from, relation: relation.relation, to_entity_id: relation.to, metadata: {} }));
    return { entities, relations };
  }

  function apothecaryRow(item, userId, warnings) {
    return { id: item.id, user_id: userId, name: item.name || "Untitled", type: item.type || "", type_label: item.typeLabel || "", image_url: /^https?:\/\//i.test(item.imagePath || item.image_url || "") ? (item.imagePath || item.image_url) : "", intention: item.intention || "", notes: item.notes || "", details: stripBrowserAssets(item.details || {}, warnings), ingredients: stripBrowserAssets(item.ingredients || [], warnings), living_state: item.livingState || item.living_state || {}, entity_id: item.entityId || item.entity_id || "", instance_id: item.instanceId || item.instance_id || "", grimoire_entry_id: item.grimoireEntryId || "", grimoire_status: item.grimoireStatus || "", log_to_grimoire: Boolean(item.logToGrimoire), metadata: { source: "guest-migration" } };
  }

  async function normalizeIds(table, rows, maps) {
    const key = TABLE_KEYS[table];
    if (!key || key === "user_id" || !UUID_ID_TABLES.has(table)) return rows;
    maps[table] ||= new Map();
    for (const row of rows) {
      const oldId = String(row[key] || "");
      if (uuidPattern.test(oldId)) { maps[table].set(oldId, oldId); continue; }
      const next = await deterministicUuid(table, oldId || global.SanctuaryBackup.stableStringify(row));
      if (oldId) maps[table].set(oldId, next);
      row[key] = next;
    }
    return rows;
  }

  function remapReferences(table, row, maps) {
    const references = {
      ritual_template_steps: { template_id: "ritual_templates" }, ritual_sessions: { template_id: "ritual_templates" }, ritual_session_steps: { session_id: "ritual_sessions" }, user_rituals: { template_id: "ritual_templates", session_id: "ritual_sessions" },
      saved_altars: {}, apothecary_items: { instance_id: "object_instances" }
    }[table] || {};
    for (const [field, target] of Object.entries(references)) if (row[field] && maps[target]?.has(String(row[field]))) row[field] = maps[target].get(String(row[field]));
    return row;
  }

  async function rowsByTable(preview, selected, userId) {
    const data = preview.data; const rows = {}; const warnings = []; const maps = {};
    if (selected.includes("settings") && hasValue(data.settings)) rows.user_settings = [{ user_id: userId, preferred_name: data.settings.preferred_name || "", pronouns: data.settings.pronouns || "", magical_name: data.settings.magical_name || "", default_mundane_mode: Boolean(data.settings.default_mundane_mode), default_altar_background: data.settings.default_altar_background || "", settings: clone(data.settings), updated_at: new Date().toISOString() }];
    if (selected.includes("livingLibrary")) { const library = libraryRows(data.livingLibrary, userId, warnings); rows.living_library_entries = library.entities; rows.library_relations = library.relations; }
    if (selected.includes("altars")) rows.saved_altars = (data.altars || []).map((altar) => ({ id: altar.id, user_id: userId, name: altar.name || "Guest Altar", altar_data: { ...stripBrowserAssets(altar, warnings), favorite: altar.favorite === true } }));
    if (selected.includes("apothecary")) rows.apothecary_items = (data.apothecary || []).map((item) => apothecaryRow(item, userId, warnings));
    if (selected.includes("custom")) rows.custom_cabinet_items = (data.customCabinet || []).map((item) => ({ id: item.id, user_id: userId, category: item.category || "custom", name: item.name || "Untitled", icon: item.icon || "✦", keywords: item.keywords || [], entity_id: item.entityId || "", image_url: "", item_type: item.forms?.[0]?.type || item.category || "", form_label: item.forms?.[0]?.form || "standard", forms: stripBrowserAssets(item.forms || [], warnings), storage_paths: [], metadata: { source: "guest-migration" } }));
    if (selected.includes("rituals")) {
      const lifecycle = data.ritualLifecycle || {};
      rows.ritual_templates = clone(lifecycle.templates || []);
      rows.ritual_template_steps = clone(lifecycle.templateSteps || lifecycle.template_steps || []);
      rows.ritual_sessions = clone(lifecycle.sessions || []);
      rows.ritual_session_steps = clone(lifecycle.sessionSteps || lifecycle.session_steps || []);
      rows.user_rituals = clone(data.ritualJournals || lifecycle.journals || []);
      Object.values(rows).flat().forEach((row) => { if (row && typeof row === "object") { delete row.user_id; row.user_id = userId; } });
    }
    for (const table of STAGE_ORDER) if (rows[table]?.length) await normalizeIds(table, rows[table], maps);
    for (const [table, records] of Object.entries(rows)) rows[table] = records.map((record) => remapReferences(table, record, maps));
    return { rows, maps, warnings };
  }

  async function existingKeys(database, table, key, userId) {
    if (!key) return new Set();
    const query = database.from(table).select(key).eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return new Set((data || []).map((row) => String(row[key])));
  }

  async function buildPlan(preview, selected, database, user) {
    if (!user?.id) throw new Error("Sign in before planning a guest migration.");
    if (!selected?.length) throw new Error("Choose at least one category to migrate.");
    const validationBackup = await global.SanctuaryBackup.createBackup(preview.data, { scope: "guest-browser", complete: true });
    const validation = await global.SanctuaryBackup.validateBackup(validationBackup);
    if (!validation.valid) throw new Error("Guest data did not pass the Sanctuary safety checks.");
    const transformed = await rowsByTable(preview, selected, user.id);
    const conflicts = []; const stages = [];
    for (const table of STAGE_ORDER) {
      const records = transformed.rows[table] || []; if (!records.length) continue;
      const key = TABLE_KEYS[table]; const existing = await existingKeys(database, table, key, user.id);
      let insert = key ? records.filter((record) => !existing.has(String(record[key]))) : records;
      if (table === "library_relations") {
        const { data: cloudRelations, error } = await database.from(table).select("from_entity_id,relation,to_entity_id").eq("user_id", user.id);
        if (error) throw error;
        const relationKeys = new Set((cloudRelations || []).map((record) => `${record.from_entity_id}|${record.relation}|${record.to_entity_id}`));
        insert = records.filter((record) => !relationKeys.has(`${record.from_entity_id}|${record.relation}|${record.to_entity_id}`));
        records.filter((record) => relationKeys.has(`${record.from_entity_id}|${record.relation}|${record.to_entity_id}`)).forEach((record) => conflicts.push({ table, id: `${record.from_entity_id}|${record.relation}|${record.to_entity_id}`, classification: "exact-match", resolution: "keep-cloud" }));
      }
      records.filter((record) => key && existing.has(String(record[key]))).forEach((record) => conflicts.push({ table, id: record[key], classification: "cloud-record-already-exists", resolution: "keep-cloud" }));
      stages.push({ table, key, rows: insert });
    }
    return { operationId: `guest-${preview.digest.slice(0, 16)}`, userId: user.id, digest: preview.digest, selected: [...selected], stages, conflicts, warnings: [...preview.unsupported, ...transformed.warnings], writesApplied: false };
  }

  function checkpointKey(plan) { return `${CHECKPOINT_PREFIX}:${plan.userId}:${plan.digest}`; }
  function loadCheckpoint(storage, plan) { try { return JSON.parse(storage.getItem(checkpointKey(plan))) || []; } catch { return []; } }

  async function verifyPlan(plan, database) {
    for (const stage of plan.stages) {
      if (!stage.rows.length) continue;
      if (stage.table === "library_relations") {
        const { data, error } = await database.from(stage.table).select("from_entity_id,relation,to_entity_id").eq("user_id", plan.userId);
        if (error) return false;
        const actual = new Set((data || []).map((row) => `${row.from_entity_id}|${row.relation}|${row.to_entity_id}`));
        if (!stage.rows.every((row) => actual.has(`${row.from_entity_id}|${row.relation}|${row.to_entity_id}`))) return false;
      } else {
        const key = stage.key;
        const { data, error } = await database.from(stage.table).select(key).eq("user_id", plan.userId);
        if (error) return false;
        const actual = new Set((data || []).map((row) => String(row[key])));
        if (!stage.rows.every((row) => actual.has(String(row[key])))) return false;
      }
    }
    return true;
  }

  async function applyPlan(plan, options) {
    const { database, storage, getCurrentUser, onProgress } = options;
    if (getCurrentUser()?.id !== plan.userId) throw new Error("The signed-in account changed. Migration stopped before writing.");
    if (await sourceDigest(readGuestData(storage)) !== plan.digest) throw new Error("Guest data changed after the safety backup. Review it and download a new backup.");
    const completed = new Set(loadCheckpoint(storage, plan));
    global.SaltSyncStatus?.saving(plan.userId);
    for (const stage of plan.stages) {
      if (completed.has(stage.table) || !stage.rows.length) { completed.add(stage.table); continue; }
      if (getCurrentUser()?.id !== plan.userId) { global.SaltSyncStatus?.failure(plan.userId); throw new Error("The signed-in account changed. Migration stopped safely."); }
      onProgress?.(`Migrating ${stage.table.replaceAll("_", " ")}…`);
      const { error } = await database.from(stage.table).insert(stage.rows);
      if (error) { console.warn("Guest migration stage failed.", { table: stage.table, code: error.code || "database_error" }); global.SaltSyncStatus?.failure(plan.userId); return { ...plan, complete: false, completedStages: [...completed], failedStage: stage.table, message: "Migration stopped safely. Guest data is unchanged; retry when the cloud is available." }; }
      completed.add(stage.table); storage.setItem(checkpointKey(plan), JSON.stringify([...completed]));
    }
    onProgress?.("Checking your migrated Sanctuary…");
    const expected = plan.stages.filter((stage) => stage.rows.length).map((stage) => stage.table);
    const verified = expected.every((table) => completed.has(table)) && await verifyPlan(plan, database);
    if (!verified) { global.SaltSyncStatus?.failure(plan.userId); return { ...plan, complete: false, completedStages: [...completed], message: "Migration verification did not finish. Guest data is unchanged." }; }
    global.SaltSyncStatus?.success(plan.userId);
    storage.removeItem(checkpointKey(plan));
    if (completed.has("saved_altars") && typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("savedAltarsChanged", { detail: { source: "guest-migration" } }));
    return { ...plan, complete: true, verified: true, completedStages: [...completed], guestDataPreserved: true };
  }

  function dismissalKey(userId, digest) { return `${DISMISS_PREFIX}:${userId}:${digest}`; }
  function isDismissed(storage, userId, digest) { return storage.getItem(dismissalKey(userId, digest)) === "true"; }
  function dismiss(storage, userId, digest) { storage.setItem(dismissalKey(userId, digest), "true"); }

  const api = { GUEST_SCOPE_KEY, CATEGORIES, STAGE_ORDER, TABLE_KEYS, readGuestRaw, readGuestData, hasGuestData, sourceDigest, snapshotFingerprint, currentFingerprint, createPreview, createSafetyBackup, isPreviewCurrent, deterministicUuid, stripBrowserAssets, rowsByTable, buildPlan, checkpointKey, loadCheckpoint, verifyPlan, applyPlan, dismissalKey, isDismissed, dismiss };
  global.GuestAccountMigration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
