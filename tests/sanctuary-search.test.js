const assert = require("node:assert/strict");
const test = require("node:test");
const Search = require("../js/sanctuary-search.js");

function records() {
  return {
    library: [
      { id: "quartz", group: "library", entityId: "quartz", type: "crystal", title: "Clear Quartz", aliases: ["Master Healer"], subtitle: "Crystal · Living Library", fields: { Uses: "clarity amplification" }, relationshipText: "Rosemary", relationshipContext: "Linked to Rosemary", timestamp: "2026-03-01" },
      { id: "dream-oil", group: "library", entityId: "dream-oil", type: "oil", title: "Dream Oil", fields: "private dream practice" }
    ],
    pages: [{ id: "page-1", group: "pages", type: "page", title: "Protection Notes", fields: "rosemary boundaries", href: "/grimoire/?page=page-1", timestamp: "2026-04-01" }],
    recipes: [{ id: "recipe-1", group: "apothecary", type: "oil", title: "House Protection Oil", fields: "black salt", relationshipText: "Rosemary", relationshipContext: "Contains Rosemary" }]
  };
}

test("ranking is exact title, alias, prefix, then structured and related matches", () => {
  Search.buildIndex(records());
  assert.equal(Search.search("Clear Quartz")[0].score, 1000);
  assert.equal(Search.search("Master Healer")[0].score, 900);
  assert.equal(Search.search("Clear")[0].score, 800);
  assert.equal(Search.search("clarity")[0].score, 500);
  assert.equal(Search.search("Rosemary").find((item) => item.id === "recipe-1").score, 350);
});

test("results group and filter without duplicates", () => {
  Search.buildIndex(records());
  Search.updateSource("duplicate", [{ id: "quartz", group: "library", entityId: "quartz", title: "Clear Quartz" }]);
  assert.equal(Search.search("Quartz").filter((item) => item.id === "quartz").length, 1);
  assert.deepEqual(Search.groupResults(Search.search("protection")).map((group) => group.key), ["pages", "apothecary"]);
  assert.deepEqual(Search.search("protection", { group: "pages" }).map((item) => item.id), ["page-1"]);
});

test("canonical and merged entity navigation never uses raw IDs", () => {
  const library = { resolveCanonicalEntityId: (id) => id === "legacy-quartz" || id === "quartz" ? "quartz" : null };
  assert.equal(Search.resolveDestination({ entityId: "legacy-quartz" }, library), "/grimoire/?entity=quartz");
  assert.equal(Search.resolveDestination({ entityId: "clear_quartz" }, library), null);
  assert.equal(Search.resolveDestination({ href: "/grimoire/?page=page-1" }, library), "/grimoire/?page=page-1");
});

test("progressive updates add results without rebuilding other sources", () => {
  Search.buildIndex({ library: records().library });
  assert.equal(Search.search("Ritual").length, 0);
  Search.updateSource("rituals", [{ id: "rite-1", group: "rituals", title: "Protection Ritual" }]);
  assert.equal(Search.search("Ritual")[0].id, "rite-1");
  assert.ok(Search.search("Quartz").some((item) => item.id === "quartz"));
});

test("empty, custom, hidden-layer, guest, and unsupported records remain safe", () => {
  Search.buildIndex({ local: [
    { id: "custom", group: "library", entityId: "custom", title: "Custom Sigil", fields: "guest local note" },
    { id: "hidden", group: "library", entityId: "hidden", title: "Visible Personal Layer", fields: "my practice only" },
    { id: "object", group: "currentAltar", title: "Unsupported Object", fields: { entity_id: "9668e4f1-9a69-4d23-9200-29ab39892585", notes: "context only" } }
  ] });
  assert.deepEqual(Search.search("nothing"), []);
  assert.equal(Search.search("guest")[0].id, "custom");
  assert.equal(Search.search("practice")[0].id, "hidden");
  assert.equal(Search.resolveDestination(Search.search("Unsupported")[0], { resolveCanonicalEntityId: () => null }), null);
  assert.deepEqual(Search.search("9668e4f1-9a69-4d23-9200-29ab39892585"), []);
});

test("Current Altar and Altar Cabinet remain separate result groups", () => {
  Search.buildIndex({
    current: [{ id: "placed-candle", group: "currentAltar", title: "White Candle", aliases: ["candle"] }],
    cabinet: [{ id: "cabinet-candle", group: "cabinet", title: "White Candle", aliases: ["candle", "taper", "tea light"] }]
  });
  assert.deepEqual(Search.groupResults(Search.search("candle")).map((group) => group.key), ["currentAltar", "cabinet"]);
  assert.equal(Search.search("taper", { group: "cabinet" })[0].id, "cabinet-candle");
});

test("recent limiting and stale request rejection are deterministic", () => {
  Search.buildIndex({ pages: [
    { id: "old", group: "pages", title: "Old", timestamp: "2026-01-01" },
    { id: "new", group: "pages", title: "New", timestamp: "2026-03-01" },
    { id: "middle", group: "pages", title: "Middle", timestamp: "2026-02-01" }
  ] });
  assert.deepEqual(Search.getRecent({ limit: 2 }).map((item) => item.id), ["new", "middle"]);
  assert.equal(Search.isCurrentRequest(3, 3, true), true);
  assert.equal(Search.isCurrentRequest(2, 3, true), false);
  assert.equal(Search.isCurrentRequest(3, 3, false), false);
});
