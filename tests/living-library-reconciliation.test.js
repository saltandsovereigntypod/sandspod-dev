const test = require("node:test");
const assert = require("node:assert/strict");
const Reconcile = require("../js/living-library-reconciliation.js");

const entry = (entityId, name, practice = {}, extra = {}) => ({ user_id: "user-a", entity_id: entityId, name, type: extra.type || "note", my_practice: practice, community: extra.community || {}, created_at: extra.created_at || "2025-01-01" });

test("title-only matches remain possible duplicates and distinct records are untouched", () => {
  const result = Reconcile.audit([entry("custom:a", "Rose"), entry("custom:b", "Rose")], [], "user-a");
  assert.equal(result.groups.length, 0);
  assert.equal(result.possible.length, 1);
  assert.equal(result.possible[0].classification, "possible-duplicate");
  assert.equal(result.writesApplied, false);
});

test("ritual, template, and Apothecary records group only by strong source identity", () => {
  const rows = [
    entry("old:t", "Template", { RitualTemplateId: "template-1" }), entry("ritual-template:template-1", "Template", { RitualTemplateId: "template-1" }),
    entry("old:r", "Ritual", { RitualId: "ritual-1" }), entry("ritual:ritual-1", "Ritual", { RitualId: "ritual-1" }),
    entry("old:a", "Oil", { ApothecaryItemId: "item-1" }), entry("apothecary:item-1", "Oil", { ApothecaryItemId: "item-1" })
  ];
  const result = Reconcile.audit(rows, [], "user-a");
  assert.deepEqual(result.groups.map((group) => group.key).sort(), ["apothecary:item-1", "ritual-template:template-1", "ritual:ritual-1"]);
  assert.equal(result.groups.find((group) => group.key === "ritual:ritual-1").survivorId, "ritual:ritual-1");
});

test("conflicting authored fields block automatic reconciliation while richer compatible content survives", () => {
  const conflict = Reconcile.audit([entry("old:1", "Ritual", { RitualId: "r", Reflection: "one" }), entry("ritual:r", "Ritual", { RitualId: "r", Reflection: "two" })], [], "user-a");
  assert.equal(conflict.groups[0].classification, "manual-review-required");
  const compatible = Reconcile.audit([entry("old:2", "Ritual", { RitualId: "r2" }), entry("ritual:r2", "Ritual", { RitualId: "r2", Reflection: "preserve me" })], [], "user-a");
  assert.equal(compatible.groups[0].classification, "canonical-identity-collision");
  assert.equal(compatible.groups[0].survivorId, "ritual:r2");
});

test("relationship duplicates are directional and dependency plans preserve object instances", () => {
  const relations = [{ id: "1", user_id: "user-a", from_entity_id: "old:r", relation: "used-with", to_entity_id: "herb:b", metadata: {} }, { id: "2", user_id: "user-a", from_entity_id: "old:r", relation: "used-with", to_entity_id: "herb:b", metadata: {} }, { id: "3", user_id: "user-a", from_entity_id: "herb:b", relation: "used-with", to_entity_id: "old:r", metadata: {} }];
  const audit = Reconcile.audit([entry("old:r", "Ritual", { RitualId: "r" }), entry("ritual:r", "Ritual", { RitualId: "r" })], relations, "user-a");
  assert.equal(audit.relationshipDuplicates.length, 1);
  const plan = Reconcile.buildPlan(audit, { relations, objectInstances: [{ id: "instance-1", entity_id: "old:r" }], ritualLinks: [{ id: "link-1", entity_id: "old:r" }] });
  assert.equal(plan.writesApplied, false);
  assert.match(plan.digest, /^reconcile-/);
  assert.deepEqual(plan.redirects[0].objectInstances.map((row) => row.id), ["instance-1"]);
  assert.deepEqual(plan.redirects[0].ritualLinks.map((row) => row.id), ["link-1"]);
});

test("other users are excluded from a current-user audit", () => {
  const other = { ...entry("ritual:r", "Ritual", { RitualId: "r" }), user_id: "user-b" };
  const result = Reconcile.audit([entry("old:r", "Ritual", { RitualId: "r" }), other], [], "user-a");
  assert.equal(result.groups.length, 0);
});
