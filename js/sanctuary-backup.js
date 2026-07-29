(function initializeSanctuaryBackup(global) {
  "use strict";

  const FORMAT = "salt-and-sovereignty-sanctuary-backup";
  const VERSION = 1;
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_ASSET_BYTES = 2 * 1024 * 1024;
  const MAX_ASSETS = 100;
  const PAGE_SIZE = 1000;
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor", "access_token", "refresh_token", "password", `service${"_role"}`, `service${"_role_key"}`, "supabasePublishableKey", "supabaseUrl", "moderatorIds", "role", "roles", "app_metadata", "user_metadata"]);
  const OWNERSHIP_KEYS = new Set(["user_id", "owner_id", "created_by"]);
  const GUEST_KEYS = Object.freeze({
    settings: "saltAndSovereigntyUserSettings",
    altars: "saltAndSovereigntySavedAltars",
    altarDraft: "saltAndSovereigntyWorkingAltarDraft",
    livingLibrary: "saltAndSovereigntyLibrary",
    livingLibraryLayouts: "saltAndSovereigntyLibraryPageLayouts",
    apothecary: "saltAndSovereigntyApothecaryItems",
    ritualJournals: "saltAndSovereigntyUserRituals",
    ritualLifecycle: "saltAndSovereigntyRitualLifecycle:guest",
    customCabinet: "saltAndSovereigntyCustomCabinetItems",
    mundaneMode: "saltAndSovereigntyMundaneMode"
  });
  const CLOUD_SECTIONS = Object.freeze({
    settings: ["user_settings"],
    altars: ["saved_altars", "custom_altar_backgrounds", "custom_cabinet_items", "custom_cabinet_image_overrides"],
    grimoire: ["grimoire_books", "grimoire_sections", "grimoire_pages", "grimoire_blocks", "grimoire_page_links"],
    livingLibrary: ["living_library_entries", "library_relations", "object_instances", "object_instance_events"],
    apothecary: ["apothecary_items"],
    rituals: ["ritual_templates", "ritual_template_steps", "ritual_sessions", "ritual_session_steps", "user_rituals", "ritual_links"],
    community: ["community_submissions", "community_submission_messages"]
  });
  const RESTORE_ORDER = Object.freeze(["user_settings", "grimoire_books", "grimoire_sections", "living_library_entries", "grimoire_pages", "grimoire_blocks", "apothecary_items", "ritual_templates", "ritual_template_steps", "ritual_sessions", "ritual_session_steps", "user_rituals", "saved_altars", "custom_cabinet_items", "custom_altar_backgrounds", "custom_cabinet_image_overrides", "object_instances", "object_instance_events", "grimoire_page_links", "library_relations", "ritual_links", "community_submissions"]);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const isForbiddenKey = (key) => FORBIDDEN_KEYS.has(key) || /(?:^|_)(?:access|refresh|auth|id)?token(?:$|_)|password|client_secret|secret_key|service.role|supabase(?:url|key)|moderator(?:id|role)|authorization/i.test(key);

  function sanitize(value, options = {}, path = "") {
    if (Array.isArray(value)) return value.map((item, index) => sanitize(item, options, `${path}[${index}]`));
    if (!isPlainObject(value)) {
      if (typeof value !== "string") return value;
      const clean = value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
      if (!/^https?:\/\//i.test(clean)) return clean;
      try { const url = new URL(clean); [...url.searchParams.keys()].forEach((key) => { if (/token|signature|credential|key/i.test(key)) url.searchParams.delete(key); }); return url.href; } catch { return clean; }
    }
    const output = Object.create(null);
    for (const [key, child] of Object.entries(value)) {
      if (isForbiddenKey(key) || (!options.keepOwnership && OWNERSHIP_KEYS.has(key))) continue;
      output[key] = sanitize(child, options, path ? `${path}.${key}` : key);
    }
    return output;
  }

  function stableStringify(value) {
    const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object" && (isPlainObject(item) || Object.getPrototypeOf(item) === null)
      ? Object.keys(item).sort().reduce((result, key) => { result[key] = sort(item[key]); return result; }, {}) : item;
    return JSON.stringify(sort(value));
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    if (global.crypto?.subtle) {
      const digest = await global.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    if (typeof require === "function") return require("node:crypto").createHash("sha256").update(bytes).digest("hex");
    throw new Error("SHA-256 is unavailable in this browser.");
  }

  function arraysIn(section) {
    if (Array.isArray(section)) return [section];
    if (!section || typeof section !== "object" || (!isPlainObject(section) && Object.getPrototypeOf(section) !== null)) return [];
    return Object.values(section).flatMap((value) => arraysIn(value));
  }

  function recordCounts(data) {
    return Object.fromEntries(Object.entries(data).map(([section, value]) => [section, arraysIn(value).reduce((sum, records) => sum + records.length, 0)]));
  }

  async function createBackup(data, options = {}) {
    const clean = sanitize(data);
    const counts = recordCounts(clean);
    const backup = {
      format: FORMAT, version: VERSION, createdAt: options.createdAt || new Date().toISOString(),
      application: { name: "Salt & Sovereignty", environment: options.environment || "unknown" },
      owner: { exportScope: options.scope || "guest-browser" },
      manifest: { sections: Object.keys(clean).sort(), recordCounts: counts, assetCount: (options.assets || []).length, complete: options.complete !== false, warnings: options.warnings || [] },
      data: clean, assets: sanitize(options.assets || []), integrity: { algorithm: "SHA-256", digest: "" }
    };
    const unsigned = clone(backup); unsigned.integrity.digest = "";
    backup.integrity.digest = await sha256(stableStringify(unsigned));
    return backup;
  }

  function collectGuest(storage) {
    const data = {};
    for (const [section, key] of Object.entries(GUEST_KEYS)) {
      const raw = storage.getItem(key);
      if (raw == null) continue;
      try { data[section] = JSON.parse(raw); } catch { data[section] = raw; }
    }
    return sanitize(data);
  }

  async function fetchAllOwned(database, table, userId, signal) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      if (signal?.aborted) throw new DOMException("Export cancelled.", "AbortError");
      const { data, error } = await database.from(table).select("*").eq("user_id", userId).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) return rows.map((row) => sanitize(row));
    }
  }

  async function collectCloud(database, user, options = {}) {
    if (!user?.id) throw new Error("Sign in before exporting cloud data.");
    const data = {}; const failures = [];
    for (const [section, tables] of Object.entries(CLOUD_SECTIONS)) {
      data[section] = {};
      options.onProgress?.(`Gathering ${section}…`);
      for (const table of tables) {
        try {
          if (options.getCurrentUser && options.getCurrentUser()?.id !== user.id) throw new Error("The signed-in user changed during export.");
          if (table === "community_submission_messages") {
            const submissionIds = data.community?.community_submissions?.map((row) => row.id).filter(Boolean) || [];
            const messages = [];
            for (let index = 0; index < submissionIds.length; index += 100) {
              const { data: rows, error } = await database.from(table).select("*").in("submission_id", submissionIds.slice(index, index + 100));
              if (error) throw error; messages.push(...(rows || []).map((row) => sanitize(row)));
            }
            data[section][table] = messages;
          } else data[section][table] = await fetchAllOwned(database, table, user.id, options.signal);
        } catch (error) { failures.push({ section, table, message: "This section could not be collected." }); options.onTechnicalError?.(table, error); }
      }
    }
    return { data, failures, complete: failures.length === 0 };
  }

  function findAssetReferences(value, found = new Set()) {
    if (typeof value === "string" && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value) || /^https?:\/\//i.test(value))) found.add(value);
    else if (Array.isArray(value)) value.forEach((item) => findAssetReferences(item, found));
    else if (value && typeof value === "object") Object.values(value).forEach((item) => findAssetReferences(item, found));
    return [...found];
  }

  async function collectAssets(data, options = {}) {
    const assets = []; const warnings = [];
    for (const url of findAssetReferences(data)) {
      if (assets.length >= MAX_ASSETS) { warnings.push(`Only the first ${MAX_ASSETS} supported assets were embedded.`); break; }
      if (url.startsWith("data:")) {
        if (url.length <= MAX_ASSET_BYTES * 1.4) assets.push({ id: await sha256(url), source: "embedded", mediaType: url.slice(5, url.indexOf(";")), dataUrl: url });
        else warnings.push("One embedded image exceeded the backup size limit.");
        continue;
      }
      if (!options.fetch) { warnings.push(`Remote asset not embedded: ${url}`); continue; }
      try {
        const response = await options.fetch(url, { credentials: "omit" });
        const type = response.headers.get("content-type") || "";
        if (!response.ok || !/^image\/(?:png|jpeg|webp)$/i.test(type)) throw new Error("Unsupported asset response.");
        const blob = await response.blob(); if (blob.size > MAX_ASSET_BYTES) throw new Error("Asset too large.");
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
        const source = new URL(url); source.search = ""; source.hash = "";
        assets.push({ id: await sha256(url), source: source.href, mediaType: type, dataUrl });
      } catch { warnings.push(`Remote asset could not be embedded: ${url}`); }
    }
    return { assets, warnings };
  }

  function validateIds(data, errors) {
    const visit = (value, path) => {
      if (Array.isArray(value)) {
        const ids = new Set(); value.forEach((record, index) => { if (record && typeof record === "object" && record.id != null) { const id = String(record.id); if (!id) errors.push(`${path}[${index}] has an empty ID.`); if (ids.has(id)) errors.push(`${path} contains duplicate ID ${id}.`); ids.add(id); } visit(record, `${path}[${index}]`); });
      } else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => visit(child, path ? `${path}.${key}` : key));
    }; visit(data, "data");
  }

  function scanForbidden(value, errors, path = "") {
    if (typeof value === "string") { if (/<(?:script|iframe|object|embed)\b|javascript:/i.test(value)) errors.push(`Unsafe active content at ${path}.`); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (isForbiddenKey(key) || OWNERSHIP_KEYS.has(key)) errors.push(`Forbidden field: ${next}`);
      scanForbidden(child, errors, next);
    }
  }

  async function validateBackup(input) {
    const errors = []; let backup;
    const text = typeof input === "string" ? input : stableStringify(input);
    if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) return { valid: false, errors: ["Backup exceeds the 25 MB JSON limit."] };
    try { backup = typeof input === "string" ? JSON.parse(input) : clone(input); } catch { return { valid: false, errors: ["This file is not valid JSON."] }; }
    if (backup?.format !== FORMAT) errors.push("This is not a Salt & Sovereignty Sanctuary backup.");
    if (backup?.version !== VERSION) errors.push(`Backup version ${backup?.version ?? "unknown"} is not supported.`);
    if (!backup?.createdAt || Number.isNaN(Date.parse(backup.createdAt))) errors.push("Backup creation date is invalid.");
    if (!backup?.data || !backup?.manifest || !backup?.integrity) errors.push("Required backup sections are missing.");
    if (backup?.manifest?.complete !== true) errors.push("This backup is marked partial and cannot be restored safely.");
    scanForbidden(backup?.data, errors); validateIds(backup?.data || {}, errors);
    const actualCounts = recordCounts(backup?.data || {});
    for (const [section, count] of Object.entries(backup?.manifest?.recordCounts || {})) if (actualCounts[section] !== count) errors.push(`Record count mismatch in ${section}.`);
    for (const asset of backup?.assets || []) if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(asset.dataUrl || "") || String(asset.dataUrl).length > MAX_ASSET_BYTES * 1.4) errors.push("Backup contains an invalid or oversized asset.");
    if (backup?.integrity?.digest) { const unsigned = clone(backup); unsigned.integrity.digest = ""; if (await sha256(stableStringify(unsigned)) !== backup.integrity.digest) errors.push("Backup integrity check failed."); }
    else errors.push("Backup has no integrity digest.");
    return { valid: errors.length === 0, errors, backup: errors.length ? null : sanitize(backup) };
  }

  function buildGuestMergePlan(backup, storage) {
    const operations = []; const conflicts = [];
    for (const [section, key] of Object.entries(GUEST_KEYS)) {
      if (!(section in (backup.data || {}))) continue;
      let existing = null; try { existing = JSON.parse(storage.getItem(key)); } catch { existing = storage.getItem(key); }
      const incoming = clone(backup.data[section]);
      if (Array.isArray(existing) && Array.isArray(incoming)) {
        const byId = new Map(existing.map((record) => [String(record?.id), record]));
        incoming.forEach((record) => { const id = String(record?.id || ""); if (id && byId.has(id)) conflicts.push({ section, id, resolution: "kept-existing" }); else if (id) byId.set(id, record); else existing.push(record); });
        operations.push({ section, key, value: [...byId.values(), ...existing.filter((record) => !record?.id)] });
      } else if (existing && isPlainObject(existing) && isPlainObject(incoming)) operations.push({ section, key, value: { ...incoming, ...existing } });
      else if (existing != null) conflicts.push({ section, id: null, resolution: "kept-existing" });
      else operations.push({ section, key, value: incoming });
    }
    return { strategy: "merge", scope: "guest", operations, conflicts, writesApplied: false };
  }

  function applyGuestMergePlan(plan, storage) {
    if (plan.writesApplied) return plan;
    plan.operations.forEach((operation) => storage.setItem(operation.key, typeof operation.value === "string" ? operation.value : JSON.stringify(operation.value)));
    return { ...plan, writesApplied: true, completedStages: plan.operations.map((operation) => operation.section) };
  }

  function flattenCloudData(data) {
    const tables = {};
    Object.values(data || {}).forEach((section) => { if (section && typeof section === "object" && !Array.isArray(section)) Object.entries(section).forEach(([table, rows]) => { if (Array.isArray(rows)) tables[table] = rows; }); });
    return tables;
  }

  async function buildCloudMergePlan(backup, database, userId) {
    if (!userId) throw new Error("A current account is required for cloud restore.");
    const tables = flattenCloudData(backup.data); const operations = []; const conflicts = [];
    for (const table of RESTORE_ORDER) {
      const rows = tables[table] || []; if (!rows.length) continue;
      const ids = rows.map((row) => row.id).filter(Boolean);
      const existingIds = new Set();
      for (let index = 0; index < ids.length; index += 200) {
        const { data, error } = await database.from(table).select("id").eq("user_id", userId).in("id", ids.slice(index, index + 200));
        if (error) throw error;
        (data || []).forEach((row) => existingIds.add(String(row.id)));
      }
      const insert = rows.filter((row) => !row.id || !existingIds.has(String(row.id))).map((row) => ({ ...sanitize(row), user_id: userId }));
      rows.filter((row) => row.id && existingIds.has(String(row.id))).forEach((row) => conflicts.push({ table, id: row.id, resolution: "kept-existing" }));
      operations.push({ table, rows: insert });
    }
    return { strategy: "merge", scope: "authenticated-user", userId, operations, conflicts, writesApplied: false, completedStages: [] };
  }

  async function applyCloudMergePlan(plan, database, options = {}) {
    const completed = new Set(options.completedStages || plan.completedStages || []);
    for (const operation of plan.operations) {
      if (completed.has(operation.table) || !operation.rows.length) { completed.add(operation.table); continue; }
      options.onProgress?.(`Restoring ${operation.table}…`);
      const { error } = await database.from(operation.table).insert(operation.rows);
      if (error) return { ...plan, writesApplied: true, completedStages: [...completed], failedStage: operation.table, error: "Restore stopped safely before the next stage." };
      completed.add(operation.table);
      options.onStageComplete?.(operation.table, [...completed]);
    }
    return { ...plan, writesApplied: true, completedStages: [...completed], failedStage: null, error: null };
  }

  function downloadJson(value, filename, documentRef = global.document) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = documentRef.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const api = { FORMAT, VERSION, MAX_FILE_BYTES, MAX_ASSET_BYTES, MAX_ASSETS, PAGE_SIZE, GUEST_KEYS, CLOUD_SECTIONS, RESTORE_ORDER, sanitize, stableStringify, sha256, recordCounts, createBackup, collectGuest, fetchAllOwned, collectCloud, findAssetReferences, collectAssets, validateBackup, buildGuestMergePlan, applyGuestMergePlan, flattenCloudData, buildCloudMergePlan, applyCloudMergePlan, downloadJson };
  global.SanctuaryBackup = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
