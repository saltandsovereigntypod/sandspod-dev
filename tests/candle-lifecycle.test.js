const test = require("node:test");
const assert = require("node:assert/strict");
const Candle = require("../altar/js/features/candle-lifecycle.js");

const minute = 60_000;
const start = Date.parse("2026-01-01T00:00:00.000Z");

test("every catalog candle form has one realistic centralized default", () => {
  assert.deepEqual(Object.keys(Candle.FORMS), ["chime-spell", "taper", "tea-light", "pillar", "vigil"]);
  Object.values(Candle.FORMS).forEach((form) => {
    assert.ok(form.defaultBurnMs > 0);
    assert.match(form.sourceNote, /Approximate/);
  });
});

test("form alone determines default duration", () => {
  const plain = Candle.normalize({}, { form: "vigil", color: "white" });
  const dressed = Candle.normalize({ dressings: [{ type: "oil" }] }, { form: "vigil", color: "purple" });
  assert.equal(plain.expectedBurnMs, dressed.expectedBurnMs);
});

test("unknown custom form requires a manual duration", () => {
  assert.equal(Candle.normalize({}, { form: "handmade" }).expectedBurnMs, 0);
  assert.throws(() => Candle.light({}, start, { form: "handmade" }), /expected candle life/);
});

test("duration edits are valid only before first lighting", () => {
  const edited = Candle.setExpectedDuration(Candle.fresh("tea-light"), 90 * minute, { now: start });
  assert.equal(edited.expectedBurnMs, 90 * minute);
  const lit = Candle.light(edited, start, { instanceId: "one" }).candle;
  assert.equal(lit.durationLocked, true);
  assert.equal(lit.firstLitAt, "2026-01-01T00:00:00.000Z");
  assert.throws(() => Candle.setExpectedDuration(lit, 2 * minute), /locked/);
});

test("a failed light does not create a duration lock", () => {
  const custom = Candle.normalize({}, { form: "custom" });
  assert.throws(() => Candle.light(custom, start, { instanceId: "custom" }));
  assert.equal(custom.durationLocked, false);
});

test("multiple burn intervals accumulate and stop while unlit", () => {
  let candle = Candle.setExpectedDuration(Candle.fresh("tea-light"), 60 * minute);
  candle = Candle.light(candle, start, { instanceId: "one" }).candle;
  candle = Candle.extinguish(candle, start + 5 * minute, "manual_extinguish", { instanceId: "one" }).candle;
  assert.equal(candle.totalBurnMs, 5 * minute);
  candle = Candle.light(candle, start + 20 * minute, { instanceId: "one" }).candle;
  candle = Candle.extinguish(candle, start + 30 * minute, "ritual_ended", { instanceId: "one", ritualId: "ritual" }).candle;
  assert.equal(candle.totalBurnMs, 15 * minute);
  assert.equal(candle.burnHistory.length, 2);
  assert.equal(candle.burnHistory[1].endReason, "ritual_ended");
});

test("closing and reopening uses timestamps and burns out exactly once", () => {
  let candle = Candle.setExpectedDuration(Candle.fresh("tea-light"), 2 * minute);
  candle = Candle.light(candle, start, { instanceId: "one" }).candle;
  const first = Candle.reconcile(candle, start + 3 * minute, { instanceId: "one" });
  assert.equal(first.candle.status, "spent");
  assert.equal(first.candle.totalBurnMs, 2 * minute);
  assert.equal(first.candle.burnHistory.length, 1);
  assert.equal(first.notificationNeeded, true);
  const second = Candle.reconcile(first.candle, start + 4 * minute, { instanceId: "one" });
  assert.equal(second.changed, false);
  assert.equal(second.candle.burnHistory.length, 1);
  assert.equal(Candle.remainingMs(second.candle), 0);
});

test("duplicate light and extinguish events are idempotent", () => {
  let candle = Candle.light(Candle.fresh("tea-light"), start, { instanceId: "one" }).candle;
  assert.equal(Candle.light(candle, start + minute, { instanceId: "one" }).duplicate, true);
  const stopped = Candle.extinguish(candle, start + minute, "manual_extinguish", { instanceId: "one" });
  const duplicate = Candle.extinguish(stopped.candle, start + 2 * minute, "manual_extinguish", { instanceId: "one" });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.candle.burnHistory.length, 1);
});

test("spent candles cannot be revived", () => {
  const spent = Candle.normalize({ form: "tea-light", expectedBurnMs: minute, totalBurnMs: minute, spentAt: new Date(start).toISOString() });
  assert.throws(() => Candle.light(spent, start + minute), /spent/);
  assert.equal(Candle.normalize({ ...spent, status: "unlit", totalBurnMs: 0 }).status, "spent");
});

test("fresh duplicates and replacements never copy burn state", () => {
  const duplicate = Candle.fresh("vigil", { dressings: [{ type: "oil" }] });
  const replacement = Candle.fresh("vigil", { replacesInstanceId: "old", dressings: [] });
  for (const candle of [duplicate, replacement]) {
    assert.equal(candle.status, "unlit");
    assert.equal(candle.totalBurnMs, 0);
    assert.deepEqual(candle.burnHistory, []);
    assert.equal(candle.durationLocked, false);
  }
  assert.equal(replacement.replacesInstanceId, "old");
  assert.deepEqual(replacement.dressings, []);
});

test("archive preserves history and is distinct from spent", () => {
  const spent = Candle.normalize({ form: "tea-light", expectedBurnMs: minute, totalBurnMs: minute, spentAt: new Date(start).toISOString() });
  const archived = Candle.archive(spent, "new");
  assert.equal(archived.status, "archived");
  assert.equal(archived.replacedByInstanceId, "new");
  assert.equal(archived.totalBurnMs, minute);
});

test("event identity deduplicates merged histories", () => {
  const record = { eventId: "same", litAt: new Date(start).toISOString(), extinguishedAt: new Date(start + minute).toISOString(), durationMs: minute };
  const merged = Candle.normalize({ form: "tea-light", burnHistory: [record, record] });
  assert.equal(merged.burnHistory.length, 1);
  assert.equal(merged.totalBurnMs, minute);
});

test("ritual warnings include only explicitly linked insufficient candles", () => {
  const warnings = Candle.ritualWarnings([
    { instanceId: "linked", label: "Linked", ritualIncluded: true, form: "tea-light", candle: { form: "tea-light", expectedBurnMs: 5 * minute } },
    { instanceId: "decorative", label: "Decorative", ritualIncluded: false, form: "tea-light", candle: { form: "tea-light", expectedBurnMs: minute } },
    { instanceId: "enough", label: "Enough", ritualIncluded: true, form: "vigil", candle: { form: "vigil" } }
  ], 10 * minute, start);
  assert.deepEqual(warnings.map((warning) => warning.instanceId), ["linked"]);
});

test("ritual candle end behavior values are constrained", () => {
  assert.deepEqual(Candle.END_BEHAVIORS, ["keep_burning", "extinguish_at_end", "ask_at_end"]);
});
