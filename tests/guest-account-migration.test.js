const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
if (!global.CustomEvent) global.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
if (!global.dispatchEvent) global.dispatchEvent = () => true;
if (!global.addEventListener) global.addEventListener = () => {};
require("../js/sanctuary-backup.js");
const Migration = require("../js/guest-account-migration.js");

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
function guestStorage(extra = {}) {
  return storage({
    saltAndSovereigntyGuestScope: "true",
    saltAndSovereigntyUserSettings: JSON.stringify({ preferred_name: "Guest" }),
    saltAndSovereigntySavedAltars: JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", name: "Quiet Altar", objects: [] }]),
    saltAndSovereigntyLibrary: JSON.stringify({ entities: { "traditional:herb:sage": { id: "traditional:herb:sage", name: "Sage", type: "herb", myPractice: { Notes: "Guest note" } } }, relations: [] }),
    saltAndSovereigntyApothecaryItems: JSON.stringify([{ id: "22222222-2222-4222-8222-222222222222", name: "Oil", ingredients: [{ entityId: "traditional:herb:sage" }] }]),
    saltAndSovereigntyUserRituals: JSON.stringify([{ id: "33333333-3333-4333-8333-333333333333", title: "Ritual", user_id: null }]),
    ...extra
  });
}
function fakeDatabase(existing = {}, failureTable = null) {
  const writes = [];
  return { writes, from(table) {
    const builder = {
      select() { return builder; }, eq() { return builder; },
      then(resolve) { return Promise.resolve(resolve({ data: existing[table] || [], error: null })); },
      async insert(rows) { if (table === failureTable) return { error: { code: "offline" } }; writes.push({ table, rows }); (existing[table] ||= []).push(...rows); return { error: null }; }
    };
    return builder;
  } };
}

test("reset title is semantic, restrained, responsive, and not a hero title", () => {
  const page = fs.readFileSync("account/reset-password/index.html", "utf8");
  const css = fs.readFileSync("css/styles.css", "utf8");
  assert.match(page, /<h1 class="reset-password-title" id="reset-password-title">Choose a New Password<\/h1>/);
  assert.doesNotMatch(page, /hero-title[^>]*>Choose a New Password/);
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.match(css, /\.account-reset-card \.reset-password-title[^}]+font-size:\s*clamp\(2rem, 6vw, 3\.5rem\)/s);
  assert.match(css, /\.account-reset-card form \{[^}]*display:\s*grid/s);
});

test("guest detection and preview are allow-listed, write-free, and count categories", async () => {
  const local = guestStorage({ unrelated: JSON.stringify([{ id: "never-read" }]) });
  assert.equal(Migration.hasGuestData(local), true);
  const preview = await Migration.createPreview(local);
  assert.equal(preview.counts.settings, 1);
  assert.equal(preview.counts.altars, 1);
  assert.equal(preview.counts.livingLibrary, 1);
  assert.equal(preview.counts.apothecary, 1);
  assert.equal(preview.counts.rituals, 1);
  assert.equal(preview.counts.grimoire, 0);
  assert.equal(local.values.has("unrelated"), true);
  assert.equal([...local.values.keys()].some((key) => key.startsWith("migration-write")), false);
  assert.equal(Migration.hasGuestData(storage()), false);
  const ui = fs.readFileSync("js/guest-account-migration-ui.js", "utf8");
  assert.match(ui, /!user\?\.id[\s\S]*!global\.GuestAccountMigration\?\.hasGuestData\(localStorage\)/);
});

test("dismissal belongs to one user and snapshot; changed guest work is eligible again", async () => {
  const local = guestStorage(); const preview = await Migration.createPreview(local);
  Migration.dismiss(local, "user-a", preview.fingerprint);
  assert.equal(Migration.isDismissed(local, "user-a", preview.fingerprint), true);
  assert.equal(Migration.isDismissed(local, "user-b", preview.fingerprint), false);
  local.setItem("saltAndSovereigntyUserSettings", JSON.stringify({ preferred_name: "Changed" }));
  assert.notEqual(Migration.currentFingerprint(local), preview.fingerprint);
  assert.equal(Migration.isDismissed(local, "user-a", Migration.currentFingerprint(local)), false);
});

test("safety backup is format version 1 and stale snapshots invalidate its gate", async () => {
  global.SaltEnvironment = { name: "development" };
  const local = guestStorage(); const preview = await Migration.createPreview(local);
  const backup = await Migration.createSafetyBackup(preview);
  assert.equal(backup.version, 1);
  assert.equal(backup.format, "salt-and-sovereignty-sanctuary-backup");
  assert.equal(await Migration.isPreviewCurrent(local, preview), true);
  local.setItem("saltAndSovereigntySavedAltars", JSON.stringify([]));
  assert.equal(await Migration.isPreviewCurrent(local, preview), false);
});

test("planning keeps cloud conflicts and preserves canonical Library identity", async () => {
  const local = guestStorage(); const preview = await Migration.createPreview(local);
  const db = fakeDatabase({ saved_altars: [{ id: "11111111-1111-4111-8111-111111111111" }] });
  const plan = await Migration.buildPlan(preview, ["altars", "livingLibrary", "apothecary", "rituals"], db, { id: "user-a" });
  assert.ok(plan.conflicts.some((item) => item.table === "saved_altars" && item.resolution === "keep-cloud"));
  assert.equal(plan.stages.find((stage) => stage.table === "saved_altars").rows.length, 0);
  assert.equal(plan.stages.find((stage) => stage.table === "living_library_entries").rows[0].entity_id, "traditional:herb:sage");
  assert.equal(plan.stages.find((stage) => stage.table === "apothecary_items").rows[0].ingredients[0].entityId, "traditional:herb:sage");
  assert.equal(plan.stages.find((stage) => stage.table === "user_rituals").rows[0].user_id, "user-a");
});

test("deterministic remapping is stable and known child references follow parents", async () => {
  const first = await Migration.deterministicUuid("ritual_sessions", "legacy-session");
  const second = await Migration.deterministicUuid("ritual_sessions", "legacy-session");
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/);
  const preview = { data: { ritualLifecycle: { templates: [{ id: "legacy-template" }], sessions: [{ id: "legacy-session", template_id: "legacy-template" }], sessionSteps: [{ id: "legacy-step", session_id: "legacy-session" }] }, ritualJournals: [] }, unsupported: [] };
  const transformed = await Migration.rowsByTable(preview, ["rituals"], "user-a");
  assert.equal(transformed.rows.ritual_sessions[0].template_id, transformed.rows.ritual_templates[0].id);
  assert.equal(transformed.rows.ritual_session_steps[0].session_id, transformed.rows.ritual_sessions[0].id);
});

test("staged failure checkpoints success, preserves guest data, and retry skips completed stages", async () => {
  const local = guestStorage(); const preview = await Migration.createPreview(local);
  const planningDb = fakeDatabase();
  const plan = await Migration.buildPlan(preview, ["livingLibrary", "apothecary"], planningDb, { id: "user-a" });
  let syncSuccess = 0; global.SaltSyncStatus = { saving() {}, failure() {}, success() { syncSuccess += 1; } };
  const cloudRows = {};
  const failedDb = fakeDatabase(cloudRows, "apothecary_items");
  const failed = await Migration.applyPlan(plan, { database: failedDb, storage: local, getCurrentUser: () => ({ id: "user-a" }) });
  assert.equal(failed.complete, false);
  assert.ok(failed.completedStages.includes("living_library_entries"));
  assert.equal(local.getItem("saltAndSovereigntyApothecaryItems") !== null, true);
  assert.equal(syncSuccess, 0);
  const retryDb = fakeDatabase(cloudRows);
  const complete = await Migration.applyPlan(plan, { database: retryDb, storage: local, getCurrentUser: () => ({ id: "user-a" }) });
  assert.equal(complete.complete, true);
  assert.equal(retryDb.writes.some((write) => write.table === "living_library_entries"), false);
  assert.equal(retryDb.writes.some((write) => write.table === "apothecary_items"), true);
  assert.equal(syncSuccess, 1);
  assert.equal(local.getItem("saltAndSovereigntyApothecaryItems") !== null, true);
});

test("account changes and guest snapshot changes abort before migration writes", async () => {
  const local = guestStorage(); const preview = await Migration.createPreview(local);
  const plan = await Migration.buildPlan(preview, ["altars"], fakeDatabase(), { id: "user-a" });
  const db = fakeDatabase();
  await assert.rejects(Migration.applyPlan(plan, { database: db, storage: local, getCurrentUser: () => ({ id: "user-b" }) }), /account changed/);
  assert.equal(db.writes.length, 0);
  local.setItem("saltAndSovereigntySavedAltars", JSON.stringify([]));
  await assert.rejects(Migration.applyPlan(plan, { database: db, storage: local, getCurrentUser: () => ({ id: "user-a" }) }), /Guest data changed/);
  assert.equal(db.writes.length, 0);
});

test("unsafe guest content is rejected and legacy sign-in migration functions are no-ops", async () => {
  const unsafe = guestStorage({ saltAndSovereigntyUserSettings: JSON.stringify({ access_token: "secret" }) });
  await assert.rejects(Migration.createPreview(unsafe), /cannot be migrated safely/);
  const altar = fs.readFileSync("altar/js/core/storage.js", "utf8");
  const apothecary = fs.readFileSync("altar/js/features/apothecary.js", "utf8");
  const librarySync = fs.readFileSync("js/living-library-sync.js", "utf8");
  assert.doesNotMatch(altar.match(/async function migrateLocalAltarsToCloud\(\)[\s\S]*?\n\}/)[0], /\.from\(/);
  assert.doesNotMatch(apothecary.match(/async function migrateLocalApothecaryToCloud\(\)[\s\S]*?\n\}/)[0], /\.from\(/);
  assert.doesNotMatch(librarySync.match(/async function migrateLocalLivingLibraryToSupabaseOnce\(\)[\s\S]*?\n\}/)[0], /\.from\(/);
  assert.match(fs.readFileSync("js/guest-account-migration-ui.js", "utf8"), /guest copy remains untouched/);
  assert.doesNotMatch(fs.readFileSync("js/guest-account-migration.js", "utf8"), /localStorage\.clear\(/);
});

test("pre-auth snapshot isolates guest records from later signed-in cache hydration", async () => {
  const Account = require("../js/account-data.js");
  global.getCurrentSaltUser = () => null;
  const local = guestStorage();
  const preserved = Account.preserveGuestSnapshotBeforeAuth(local);
  assert.equal(preserved.altars[0].name, "Quiet Altar");
  local.setItem("saltAndSovereigntySavedAltars", JSON.stringify([{ id: "cloud-cache", name: "Cloud Cache" }]));
  const preview = await Migration.createPreview(local);
  assert.equal(preview.data.altars[0].name, "Quiet Altar");
  Account.markGuestDataChanged(local);
  assert.equal(local.getItem(Account.PENDING_GUEST_SNAPSHOT_KEY), null);
});
