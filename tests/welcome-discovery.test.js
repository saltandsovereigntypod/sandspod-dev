const assert = require("node:assert/strict");
const test = require("node:test");

const WelcomeDiscovery = require("../js/welcome-discovery.js");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("daily reflection persists for a local date and rotates without an immediate repeat", () => {
  const storage = createStorage();
  const first = WelcomeDiscovery.selectDailyReflection(
    storage,
    new Date(2026, 6, 28, 9),
    () => 0
  );
  const refreshed = WelcomeDiscovery.selectDailyReflection(
    storage,
    new Date(2026, 6, 28, 23),
    () => 0.9
  );
  const nextDay = WelcomeDiscovery.selectDailyReflection(
    storage,
    new Date(2026, 6, 29, 0, 1),
    () => 0
  );

  assert.equal(refreshed.id, first.id);
  assert.notEqual(nextDay.id, first.id);
});

test("Altar and Book of Shadows guide versions remain independent", () => {
  const storage = createStorage();
  assert.equal(WelcomeDiscovery.isGuideComplete(storage, "altar"), false);
  assert.equal(WelcomeDiscovery.isGuideComplete(storage, "grimoire"), false);

  WelcomeDiscovery.completeGuide(storage, "altar");
  assert.equal(WelcomeDiscovery.isGuideComplete(storage, "altar"), true);
  assert.equal(WelcomeDiscovery.isGuideComplete(storage, "grimoire"), false);

  WelcomeDiscovery.completeGuide(storage, "grimoire");
  assert.equal(WelcomeDiscovery.isGuideComplete(storage, "grimoire"), true);
});

test("gateway preserves and consumes only supported sanctuary destinations", () => {
  const storage = createStorage();
  assert.equal(WelcomeDiscovery.rememberDestination(storage, "/altar/"), "/altar/");
  assert.equal(WelcomeDiscovery.consumeDestination(storage), "/altar/");
  assert.equal(WelcomeDiscovery.consumeDestination(storage), null);

  assert.equal(WelcomeDiscovery.rememberDestination(storage, "/grimoire/"), "/grimoire/");
  assert.equal(WelcomeDiscovery.consumeDestination(storage), "/grimoire/");
  assert.equal(WelcomeDiscovery.rememberDestination(storage, "https://example.com"), null);
});
