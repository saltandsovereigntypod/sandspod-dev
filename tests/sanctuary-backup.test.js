const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Backup = require("../js/sanctuary-backup.js");
const Lifecycle = require("../js/ritual-lifecycle.js");

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}

test("ritual links always receive object metadata and remain retry-idempotent", () => {
  assert.deepEqual(Lifecycle.normalizeRitualLink({ link_type: "altar", metadata: null }).metadata, {});
  assert.deepEqual(Lifecycle.normalizeRitualLink({ link_type: "page", metadata: [] }).metadata, {});
  assert.deepEqual(Lifecycle.normalizeRitualLink({ link_type: "entity", metadata: { type: "herb" } }).metadata, { type: "herb" });
  const links = [{ link_type: "entity", entity_id: "e1" }, { link_type: "entity", entity_id: "e1", metadata: { duplicate: true } }, { link_type: "page", grimoire_page_id: "p1" }];
  const first = Lifecycle.uniqueRitualLinks(links, []);
  assert.equal(first.length, 2);
  assert.ok(first.every((link) => link.metadata && !Array.isArray(link.metadata)));
  assert.deepEqual(Lifecycle.uniqueRitualLinks(links, first), []);
});

test("ritual UI hides raw database errors and preserves a recoverable partial-save message", () => {
  const source = fs.readFileSync("altar/js/features/ritual-journal.js", "utf8");
  assert.match(source, /RitualLinkPersistenceError/);
  assert.match(source, /Your ritual was saved, but some of its connections could not be finished/);
  assert.doesNotMatch(source, /status\.textContent = error\.message/);
  assert.match(source, /ritualPrimarySaved = true/);
});

test("versioned backups have deterministic counts and verified SHA-256 integrity", async () => {
  const options = { createdAt: "2026-01-02T03:04:05.000Z", environment: "development", scope: "guest-browser" };
  const one = await Backup.createBackup({ altars: [{ id: "a1" }], rituals: { sessions: [{ id: "s1" }], steps: [{ id: "x1" }] } }, options);
  const two = await Backup.createBackup({ rituals: { steps: [{ id: "x1" }], sessions: [{ id: "s1" }] }, altars: [{ id: "a1" }] }, options);
  assert.equal(one.format, Backup.FORMAT); assert.equal(one.version, 1);
  assert.deepEqual(one.manifest.recordCounts, { altars: 1, rituals: 2 });
  assert.equal(one.integrity.digest, two.integrity.digest);
  assert.equal((await Backup.validateBackup(JSON.stringify(one))).valid, true);
  one.data.altars[0].name = "tampered";
  assert.match((await Backup.validateBackup(one)).errors.join(" "), /integrity/i);
});

test("guest collection is allow-listed and includes guest ritual lifecycle without auth caches", () => {
  const storage = memoryStorage({
    saltAndSovereigntyUserSettings: JSON.stringify({ preferred_name: "Ash" }),
    "saltAndSovereigntyRitualLifecycle:guest": JSON.stringify({ sessions: [{ id: "guest-session" }] }),
    saltAndSovereigntyActiveRitualSession: JSON.stringify({ id: "cloud-pointer", scope: "user:private" }),
    arbitraryAuthenticatedCache: JSON.stringify({ access_token: "never" })
  });
  const data = Backup.collectGuest(storage);
  assert.equal(data.settings.preferred_name, "Ash");
  assert.equal(data.ritualLifecycle.sessions[0].id, "guest-session");
  assert.equal(data.activeRitualSession, undefined);
  assert.equal(data.arbitraryAuthenticatedCache, undefined);
});

test("cloud collection paginates, strips ownership, and never calls a partial export complete", async () => {
  let ranges = 0;
  const database = { from(table) { return { select() { return this; }, eq() { return this; }, range(from) { ranges += 1; const rows = table === "user_settings" && from === 0 ? Array.from({ length: 1000 }, (_, id) => ({ id: String(id), user_id: "u1" })) : table === "user_settings" ? [{ id: "last", user_id: "u1" }] : []; return Promise.resolve({ data: rows, error: table === "saved_altars" ? new Error("offline") : null }); } }; } };
  const rows = await Backup.fetchAllOwned(database, "user_settings", "u1");
  assert.equal(rows.length, 1001); assert.equal(ranges, 2); assert.equal(rows[0].user_id, undefined);
  const partial = await Backup.collectCloud(database, { id: "u1" }, { getCurrentUser: () => ({ id: "u1" }) });
  assert.equal(partial.complete, false); assert.ok(partial.failures.some((failure) => failure.table === "saved_altars"));
});

test("validation rejects malformed, unsupported, credential-bearing, unsafe, duplicate, and oversized imports", async () => {
  assert.equal((await Backup.validateBackup("{" )).valid, false);
  const base = await Backup.createBackup({ rituals: [{ id: "same" }] }, { createdAt: "2026-01-01T00:00:00Z" });
  base.version = 99; assert.match((await Backup.validateBackup(base)).errors.join(" "), /not supported/);
  const unsafe = await Backup.createBackup({ pages: [{ id: "p1", text: "safe" }] }, { createdAt: "2026-01-01T00:00:00Z" });
  unsafe.data.pages[0].access_token = "bad"; unsafe.data.pages[0].text = "<script>alert(1)</script>";
  assert.match((await Backup.validateBackup(unsafe)).errors.join(" "), /Forbidden|Unsafe/);
  const duplicate = await Backup.createBackup({ pages: [{ id: "p1" }, { id: "p1" }] }, { createdAt: "2026-01-01T00:00:00Z" });
  assert.match((await Backup.validateBackup(duplicate)).errors.join(" "), /duplicate ID/);
  assert.equal((await Backup.validateBackup("x".repeat(Backup.MAX_FILE_BYTES + 1))).valid, false);
});

test("guest merge planning performs no writes, preserves collisions, and applies once", async () => {
  const storage = memoryStorage({ saltAndSovereigntySavedAltars: JSON.stringify([{ id: "existing", name: "Keep" }]) });
  const backup = await Backup.createBackup({ altars: [{ id: "existing", name: "Imported" }, { id: "new", name: "New" }] }, { createdAt: "2026-01-01T00:00:00Z" });
  const plan = Backup.buildGuestMergePlan(backup, storage);
  assert.equal(JSON.parse(storage.getItem("saltAndSovereigntySavedAltars")).length, 1);
  assert.equal(plan.conflicts[0].resolution, "kept-existing");
  const applied = Backup.applyGuestMergePlan(plan, storage);
  assert.equal(JSON.parse(storage.getItem("saltAndSovereigntySavedAltars")).length, 2);
  Backup.applyGuestMergePlan(applied, storage);
  assert.equal(JSON.parse(storage.getItem("saltAndSovereigntySavedAltars")).length, 2);
});

test("sanitization removes ownership, credentials, and signed URL secrets", () => {
  const clean = Backup.sanitize({ user_id: "other", password: "bad", image: "https://example.com/a.png?token=secret&width=20", nested: { title: "kept" } });
  assert.equal(clean.user_id, undefined); assert.equal(clean.password, undefined);
  assert.equal(clean.image, "https://example.com/a.png?width=20"); assert.equal(clean.nested.title, "kept");
});

test("cloud merge planning is read-only, remaps ownership at write time, and checkpoints stages", async () => {
  const writes = [];
  const database = { from(table) { return {
    select() { return this; }, eq() { return this; }, in(_field, ids) { return Promise.resolve({ data: table === "user_settings" && ids.includes("existing") ? [{ id: "existing" }] : [], error: null }); },
    insert(rows) { writes.push({ table, rows }); return Promise.resolve({ error: null }); }
  }; } };
  const backup = await Backup.createBackup({ settings: { user_settings: [{ id: "existing", value: 1 }, { id: "new", value: 2 }] } }, { createdAt: "2026-01-01T00:00:00Z", scope: "authenticated-user" });
  const plan = await Backup.buildCloudMergePlan(backup, database, "current-user");
  assert.equal(writes.length, 0); assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.operations[0].rows[0].user_id, "current-user");
  const result = await Backup.applyCloudMergePlan(plan, database);
  assert.equal(result.completedStages[0], "user_settings");
  assert.equal(writes[0].rows[0].user_id, "current-user");
});

test("Account and Data UI requires validation and a safety backup before merge", () => {
  const ui = fs.readFileSync("js/sanctuary-backup-ui.js", "utf8");
  const settings = fs.readFileSync("js/settings-view.js", "utf8");
  assert.match(ui, /Download Complete Backup/); assert.match(ui, /Download Guest Backup/);
  assert.match(ui, /Download Pre-Restore Backup/); assert.match(ui, /Merge With Existing Sanctuary/);
  assert.match(ui, /safetyBackupDownloaded = true; restore\.disabled = false/);
  assert.match(settings, /SanctuaryBackupUI\?\.mount/);
});
