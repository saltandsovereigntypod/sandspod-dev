const test = require("node:test");
const assert = require("node:assert/strict");

global.createFreshCandleLifecycle = (form) => ({ version: 2, form, expectedBurnMs: form === "taper" ? 28_800_000 : 0, durationLocked: false, totalBurnMs: 0, currentBurnStartedAt: "", status: "unlit", burnHistory: [], dressings: [] });
const { buildFreshAltarDuplicate } = require("../altar/js/features/altar-save-modes.js");

test("fresh duplicate preserves layout and entity links while replacing identities", () => {
  const source = { groups: [{ id: "g1", name: "Working" }], activeGroupId: "g1", objects: [{ altarObjectId: "placed-1", instanceId: "instance-1", entityId: "entity-1", apothecaryItemId: "recipe-1", groupId: "g1", leftPercent: .2, rotation: "15", type: "crystal", livingState: JSON.stringify({ crystal: { cleansingHistory: ["old"] } }) }] };
  const fresh = buildFreshAltarDuplicate(source);
  assert.notEqual(fresh.groups[0].id, "g1");
  assert.equal(fresh.objects[0].groupId, fresh.groups[0].id);
  assert.notEqual(fresh.objects[0].altarObjectId, "placed-1");
  assert.notEqual(fresh.objects[0].instanceId, "instance-1");
  assert.equal(fresh.objects[0].entityId, "entity-1");
  assert.equal(fresh.objects[0].apothecaryItemId, "recipe-1");
  assert.equal(fresh.objects[0].leftPercent, .2);
  assert.deepEqual(JSON.parse(fresh.objects[0].livingState).crystal.cleansingHistory, []);
  assert.equal(source.objects[0].instanceId, "instance-1");
});

test("fresh duplicate resets a spent dressed burning candle", () => {
  const state = { candle: { status: "spent", totalBurnMs: 500, currentBurnStartedAt: "2025-01-01T00:00:00Z", burnHistory: [{ durationMs: 500 }], dressings: ["oil"] }, currentRitualId: "ritual-1" };
  const fresh = buildFreshAltarDuplicate({ groups: [], objects: [{ type: "candle", form: "taper", lit: "true", ritualIncluded: "true", livingState: JSON.stringify(state) }] });
  const living = JSON.parse(fresh.objects[0].livingState);
  assert.equal(fresh.objects[0].lit, "false");
  assert.equal(fresh.objects[0].ritualIncluded, "false");
  assert.equal(living.currentRitualId, undefined);
  assert.equal(living.candle.status, "unlit");
  assert.equal(living.candle.expectedBurnMs, 28_800_000);
  assert.equal(living.candle.durationLocked, false);
  assert.equal(living.candle.totalBurnMs, 0);
  assert.deepEqual(living.candle.burnHistory, []);
  assert.deepEqual(living.candle.dressings, []);
});
