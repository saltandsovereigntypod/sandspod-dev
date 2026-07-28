const assert = require("node:assert/strict");
const test = require("node:test");

const LivingConnections = require("../js/living-connections.js");

function createLibrary() {
  const entities = {
    basil: { id: "basil", name: "Basil", type: "herb", createdAt: "2026-01-01T00:00:00Z", traditional: { Uses: "Protection" }, myPractice: {}, community: {} },
    rosemary: { id: "rosemary", name: "Rosemary", type: "herb", myPractice: {}, community: {} },
    quartz: { id: "quartz", name: "Clear Quartz", type: "crystal", myPractice: {}, community: {} }
  };
  const relations = [{ id: "pair-1", from: "basil", relation: "pairs_with", to: "rosemary" }];
  return {
    getEntity(id) {
      return entities[id] || null;
    },
    getConnections(id) {
      return relations.filter((relation) => relation.from === id || relation.to === id);
    },
    findEntityByTraditionalReference(reference) {
      return reference === "traditional/herb/basil" ? entities.basil : null;
    }
  };
}

function createSources() {
  return {
    library: createLibrary(),
    rituals: [
      { id: "r2", title: "Second ritual", ended_at: "2026-02-02T10:00:00Z", altar_snapshot: { objects: [{ entityId: "basil" }, { entityId: "rosemary" }] } },
      { id: "r1", title: "First ritual", ended_at: "2026-02-01T10:00:00Z", altar_snapshot: { objects: [{ entityId: "basil" }, { entityId: "rosemary" }] } },
      { id: "r3", title: "Latest ritual", ended_at: "2026-02-03T10:00:00Z", altar_snapshot: { objects: [{ entityId: "basil" }, { entityId: "quartz" }] } }
    ]
  };
}

test("usage computes first, last, total, and chronological order", () => {
  const usage = LivingConnections.getUsage("basil", createSources());
  assert.equal(usage.totalUses, 3);
  assert.equal(usage.firstUse.id, "ritual:r1");
  assert.equal(usage.lastUse.id, "ritual:r3");
  assert.deepEqual(usage.uses.map((event) => event.id), ["ritual:r1", "ritual:r2", "ritual:r3"]);
});

test("pairing frequency is derived from shared appearances", () => {
  const pairings = LivingConnections.getPairings("basil", createSources());
  assert.equal(pairings[0].entityId, "rosemary");
  assert.equal(pairings[0].frequency, 2);
  assert.deepEqual(pairings[0].relations, ["pairs_with"]);
  assert.equal(pairings[1].entityId, "quartz");
  assert.equal(pairings[1].frequency, 1);
  assert.equal(LivingConnections.getPairingFrequency("basil", "rosemary", createSources()), 2);
  assert.deepEqual(LivingConnections.getRitualTypeFrequency("basil", createSources()), [
    { ritualType: "free", frequency: 3 }
  ]);
});

test("timeline generation deduplicates source records and remains deterministic", () => {
  const sources = createSources();
  sources.events = [
    { id: "care-1", timestamp: "2026-02-04T10:00:00Z", type: "cleansed", source: "object_instance", label: "Cleansed" },
    { id: "care-1", timestamp: "2026-02-04T10:00:00Z", type: "cleansed", source: "object_instance", label: "Cleansed" }
  ];
  const timeline = LivingConnections.getTimeline("basil", sources);
  assert.equal(timeline.filter((event) => event.id === "care-1").length, 1);
  assert.equal(timeline[0].type, "added");
  assert.equal(timeline.at(-1).type, "cleansed");
  assert.deepEqual(
    LivingConnections.sortEvents([
      LivingConnections.createEvent({ id: "b", timestamp: "2026-01-01", type: "test", source: "test", entityId: "basil" }),
      LivingConnections.createEvent({ id: "a", timestamp: "2026-01-01", type: "test", source: "test", entityId: "basil" })
    ]).map((event) => event.id),
    ["a", "b"]
  );
});

test("canonical entity references resolve through the existing Living Library", () => {
  const library = createLibrary();
  assert.equal(LivingConnections.resolveEntityId("traditional/herb/basil", library), "basil");
  assert.equal(LivingConnections.resolveEntityId({ entity_id: "quartz" }, library), "quartz");
});

test("canonical event shape preserves related entity and object identities", () => {
  const event = LivingConnections.createEvent({
    id: "offering-1",
    occurred_at: "2026-03-01T12:00:00Z",
    type: "offering",
    source: "object_instance",
    entityId: "basil",
    relatedEntityIds: ["quartz", "quartz", "basil"],
    relatedObjectIds: ["instance-1", "instance-1"],
    label: "Offering recorded"
  });
  assert.equal(event.timestamp, "2026-03-01T12:00:00.000Z");
  assert.deepEqual(event.relatedEntityIds, ["quartz"]);
  assert.deepEqual(event.relatedObjectIds, ["instance-1"]);
});

test("reference discovery reuses Library layers and relationship edges", () => {
  const references = LivingConnections.getReferences("basil", createSources());
  assert.equal(references.relationships[0].relation, "pairs_with");
  assert.deepEqual(references.relatedEntities[0], {
    entityId: "rosemary",
    label: "Rosemary",
    entityType: "herb",
    relation: "pairs_with",
    direction: "outgoing"
  });
  assert.equal(references.layers.traditional, true);
  assert.equal(references.layers.myPractice, false);
  assert.deepEqual(references.traditionalReferences[0].fields, ["Uses"]);
  assert.equal(references.rituals.length, 3);
});

test("Living Object State histories normalize into the shared timeline", () => {
  const sources = {
    library: createLibrary(),
    livingStates: [{
      entityId: "quartz",
      objectId: "quartz-instance",
      state: {
        crystal: {
          cleansingHistory: [{ id: "cleanse-1", occurredAt: "2026-04-01T09:00:00Z" }],
          chargingHistory: [{ id: "charge-1", occurredAt: "2026-04-02T09:00:00Z" }]
        }
      }
    }]
  };
  const timeline = LivingConnections.getTimeline("quartz", sources)
    .filter((event) => event.source === "living_object_state");
  assert.deepEqual(timeline.map((event) => event.type), ["cleansed", "charged"]);
  assert.deepEqual(timeline[0].relatedObjectIds, ["quartz-instance"]);
});
