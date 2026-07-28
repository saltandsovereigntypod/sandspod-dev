const test = require("node:test");
const assert = require("node:assert/strict");
const Settings = require("../js/settings-view.js");

test("categorizes every preserved settings family", () => {
  assert.equal(Settings.categoryForName("preferred_name"), "identity");
  assert.equal(Settings.categoryForName("library_traditional_uses"), "library");
  assert.equal(Settings.categoryForName("companion_my_notes"), "companion");
  assert.equal(Settings.categoryForName("living_state_show_status"), "objects");
});

test("category restore preserves settings outside that category", () => {
  const restored = Settings.categoryDefaults({ preferred_name: "Changed", library_myPractice_enabled: false }, "identity", { preferred_name: "", library_myPractice_enabled: true });
  assert.equal(restored.preferred_name, "");
  assert.equal(restored.library_myPractice_enabled, false);
});

test("background options preserve unknown saved values and remove duplicates", () => {
  assert.deepEqual(Settings.backgroundOptions([{ name: "Forest" }, { name: "Forest" }], "Legacy"), ["Legacy", "Forest"]);
});

test("stale settings responses are rejected after edits", () => {
  assert.equal(Settings.isStale(1, 2, false), true);
  assert.equal(Settings.isStale(2, 2, true), true);
  assert.equal(Settings.isStale(2, 2, false), false);
});
