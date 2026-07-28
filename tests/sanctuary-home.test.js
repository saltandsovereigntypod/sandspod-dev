const test = require("node:test");
const assert = require("node:assert/strict");
const Sanctuary = require("../js/living-sanctuary.js");
const library = { resolveCanonicalEntityId: (id) => id === "legacy" ? "canonical" : id };

test("greeting follows preference and never falls back to email", () => {
  assert.equal(Sanctuary.greeting({ preferred_name: "Ashley" }, { email: "private@example.com" }), "Welcome Home, Ashley");
  assert.equal(Sanctuary.greeting({ magical_name: "Freyja", sanctuary_greeting_name: "magical" }), "Welcome Home, Freyja");
  assert.equal(Sanctuary.greeting({ sanctuary_greeting_name: "none" }, { email: "private@example.com" }), "Welcome Home");
});

test("continue items reject invalid destinations, deduplicate, sort, and limit", () => {
  const items = Sanctuary.continueItems([
    { id: "bad", title: "No route", timestamp: "2026-08-01" },
    { id: "a", title: "A", href: "/a", timestamp: "2026-07-01" },
    { id: "a2", title: "A again", href: "/a", timestamp: "2026-07-02" },
    { id: "entity", title: "Entity", entityId: "legacy", timestamp: "2026-07-03" }
  ], { library, limit: 2 });
  assert.deepEqual(items.map((item) => item.title), ["Entity", "A again"]);
  assert.equal(items[0].destination, "/grimoire/?entity=canonical");
});

test("scope and stale request guards separate guest and authenticated data", () => {
  assert.equal(Sanctuary.scopeKey(null), "guest");
  assert.equal(Sanctuary.scopeKey({ id: "u1" }), "user:u1");
  assert.equal(Sanctuary.isCurrentRequest(2, 2, "user:u1", "user:u1", true), true);
  assert.equal(Sanctuary.isCurrentRequest(1, 2, "user:u1", "user:u1", true), false);
  assert.equal(Sanctuary.isCurrentRequest(2, 2, "user:u1", "guest", true), false);
});
