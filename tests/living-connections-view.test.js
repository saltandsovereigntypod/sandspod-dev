const assert = require("node:assert/strict");
const test = require("node:test");

const View = require("../js/living-connections-view.js");

function result(overrides = {}) {
  return {
    entityId: "basil",
    entity: { id: "basil", name: "Basil", type: "herb", traditional: {} },
    usage: { totalUses: 0, uses: [] },
    pairings: [],
    ritualTypes: [],
    timeline: [],
    references: {},
    ...overrides
  };
}

function event(id, timestamp, source = "ritual") {
  return { id, timestamp, source, type: "ritual_use", label: `Used in ${id}`, metadata: {} };
}

test("journey summary formats structured use without zero-value statistics", () => {
  const first = event("First Rite", "2026-01-02T10:00:00Z");
  const last = event("Last Rite", "2026-02-03T10:00:00Z");
  const model = View.createJourneyModel(result({
    usage: { totalUses: 2, firstUse: first, lastUse: last, uses: [first, last] },
    ritualTypes: [{ ritualType: "protection_working", frequency: 2 }],
    timeline: [first, last]
  }));
  assert.deepEqual(model.summary.map((item) => item.label), [
    "First Worked With", "Most Recently Used", "Times Used", "Most Common Ritual Type"
  ]);
  assert.equal(model.summary[2].value, "2 recorded appearances");
  assert.equal(model.emptyMessage, "");
});

test("unused entities receive the gentle empty state", () => {
  const model = View.createJourneyModel(result());
  assert.equal(model.hasHistory, false);
  assert.equal(model.emptyMessage, View.EMPTY_JOURNEY_MESSAGE);
  assert.deepEqual(model.summary, []);
});

test("pairings and recent events are limited and newest-first", () => {
  const pairings = [1, 2, 3].map((frequency) => ({
    entity: { id: `entity-${frequency}`, name: `Entity ${frequency}`, type: "herb" }, frequency
  }));
  const model = View.createJourneyModel(result({
    pairings,
    timeline: [event("old", "2026-01-01"), event("middle", "2026-02-01"), event("new", "2026-03-01")]
  }), { pairingLimit: 2, eventLimit: 2 });
  assert.equal(model.pairings.length, 2);
  assert.deepEqual(model.recentEvents.map((item) => item.id), ["new", "middle"]);
  assert.deepEqual(model.olderEvents.map((item) => item.id), ["old"]);
});

test("references are grouped, deduplicated, and limited", () => {
  const ritual = event("Protection Working", "2026-03-01");
  const groups = View.groupReferences({ rituals: [ritual, ritual, ...Array.from({ length: 5 }, (_, index) => event(`Rite ${index}`, `2026-03-0${index + 1}`))] });
  assert.equal(groups[0].key, "rituals");
  assert.equal(groups[0].visible.length, 4);
  assert.equal(groups[0].total, 6);
});

test("full-entry links require a canonical entity identity", () => {
  assert.equal(View.fullEntryUrl("basil"), "/grimoire/?entity=basil");
  assert.equal(View.fullEntryUrl(""), null);
  assert.equal(View.createJourneyModel(result({ entityId: null, entity: null })).fullEntryHref, null);
});

test("personal history is independent of Traditional visibility and works for custom entities", () => {
  const use = event("Custom Working", "2026-04-01");
  const model = View.createJourneyModel(result({
    entityId: "dream-oil",
    entity: { id: "dream-oil", name: "Dream Oil", type: "apothecary", traditional: {}, metadata: { traditionalReference: null } },
    usage: { totalUses: 1, firstUse: use, lastUse: use, uses: [use] },
    timeline: [use],
    references: { layers: { traditional: false, myPractice: true, community: false } }
  }));
  assert.equal(model.hasHistory, true);
  assert.equal(model.entityName, "Dream Oil");
  assert.equal(model.fullEntryHref, "/grimoire/?entity=dream-oil");
});

test("request identity prevents stale Companion and entity-page results", () => {
  assert.equal(View.isCurrentRequest(4, 4, "basil", "basil"), true);
  assert.equal(View.isCurrentRequest(3, 4, "basil", "basil"), false);
  assert.equal(View.isCurrentRequest(4, 4, "basil", "rosemary"), false);
});
