const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cleanup = require("../js/ritual-legacy-cleanup.js");
const backup = require("../js/sanctuary-backup.js");

test("ritual completion no longer creates legacy Grimoire records", () => {
  const source = fs.readFileSync("altar/js/features/ritual-journal.js", "utf8");
  assert.doesNotMatch(source, /ensureRitualJournalGrimoirePage/);
  assert.doesNotMatch(source, /page_type:\s*["']ritual_journal/);
  assert.match(source, /View in My Practice/);
});

test("nested snapshot helper IDs do not weaken row validation", async () => {
  const valid = await backup.createBackup({ livingLibrary: { living_library_entries: [{ id: "entry-1", my_practice: { Ingredients: [{ id: "" }, { id: "shared" }, { id: "shared" }] } }] }, altars: { object_instances: [{ id: "object-1", metadata: { ingredients: [{ id: "" }] } }] }, rituals: { ritual_sessions: [{ id: "session-1", altar_snapshot: [{ id: "same" }, { id: "same" }] }] } });
  assert.equal((await backup.validateBackup(valid)).valid, true);
  const invalid = await backup.createBackup({ rituals: { ritual_sessions: [{ id: "" }, { id: "session" }, { id: "session" }] } });
  const result = await backup.validateBackup(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /empty top-level ID/);
  assert.match(result.errors.join(" "), /duplicate top-level ID/);
});

test("guest cleanup is explicit and preserves Apothecary and Altars", () => {
  const data = new Map([["saltAndSovereigntyRitualLifecycle:guest", JSON.stringify({ sessions: [{ id: "s1" }] })], ["saltAndSovereigntyApothecaryItems", JSON.stringify([{ id: "a1" }])], ["saltAndSovereigntySavedAltars", JSON.stringify([{ id: "altar1" }])], ["saltAndSovereigntyLibrary", JSON.stringify({ entities: { "ritual:r1": { id: "ritual:r1", type: "ritual" }, herb1: { id: "herb1", type: "herb" } }, relations: [{ from: "ritual:r1", to: "herb1", relation: "contains" }], indexes: {} })]]);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  assert.throws(() => cleanup.clearGuest(storage, "wrong"));
  cleanup.clearGuest(storage, cleanup.CONFIRMATION);
  assert.equal(data.has("saltAndSovereigntyRitualLifecycle:guest"), false);
  assert.equal(JSON.parse(data.get("saltAndSovereigntyApothecaryItems"))[0].id, "a1");
  assert.equal(JSON.parse(data.get("saltAndSovereigntySavedAltars"))[0].id, "altar1");
  assert.deepEqual(Object.keys(JSON.parse(data.get("saltAndSovereigntyLibrary")).entities), ["herb1"]);
});

test("duplicate audit requires stable identity before classifying safe", () => {
  const result = cleanup.auditDuplicates({ a: { id: "a", type: "ritual_template", name: "Moon", metadata: { ritualTemplateId: "t1" } }, b: { id: "b", type: "ritual_template", name: "Renamed", metadata: { ritualTemplateId: "t1" } }, c: { id: "c", type: "herb", name: "Sage" }, d: { id: "d", type: "herb", name: "Sage" } });
  assert.equal(result.safe.length, 1);
  assert.equal(result.probable.length, 1);
});
