const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const activation = require("../altar/js/features/cabinet-activation.js");
const root = path.join(__dirname, "..");

class FakeRoot {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { this.listeners.set(type, [...(this.listeners.get(type) || []), handler]); }
  removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== handler)); }
  async emit(type, event) { for (const handler of this.listeners.get(type) || []) await handler(event); }
}

function tile(label = "Basil") {
  const item = { dataset: { label, type: "herb", form: "sprig", image: `${label}.png`, entityId: label.toLowerCase() } };
  item.closest = (selector) => selector === "[data-image]" ? item : null;
  return item;
}

function event(target, overrides = {}) {
  return {
    target, isPrimary: true, button: 0, pointerId: 7, clientX: 10, clientY: 10, detail: 1,
    preventDefault() {}, stopImmediatePropagation() {}, ...overrides
  };
}

test("one pointer gesture produces one canonical placement and suppresses its duplicate click", async () => {
  const rootNode = new FakeRoot(); const placements = [];
  activation.createController({ root: rootNode, activate: (request) => placements.push(request) });
  const item = tile();
  await rootNode.emit("pointerdown", event(item));
  await rootNode.emit("pointerup", event(item));
  await rootNode.emit("click", event(item));
  await rootNode.emit("click", event(item));
  assert.equal(placements.length, 1);
  assert.equal(placements[0].item, item);
  assert.match(placements[0].requestId, /^pointer-7-/);
});

test("scroll movement and pointer cancellation never place an item", async () => {
  const rootNode = new FakeRoot(); let placements = 0;
  activation.createController({ root: rootNode, activate: () => { placements += 1; } });
  const item = tile();
  await rootNode.emit("pointerdown", event(item));
  await rootNode.emit("pointermove", event(item, { clientY: 25 }));
  await rootNode.emit("pointerup", event(item, { clientY: 25 }));
  await rootNode.emit("click", event(item));
  await rootNode.emit("pointerdown", event(item, { pointerId: 9 }));
  await rootNode.emit("pointercancel", event(item, { pointerId: 9 }));
  await rootNode.emit("click", event(item));
  assert.equal(placements, 0);
});

test("nested targets resolve to one item and keyboard activation remains available", async () => {
  const rootNode = new FakeRoot(); const placements = [];
  activation.createController({ root: rootNode, activate: (request) => placements.push(request) });
  const item = tile("Quartz");
  const child = { closest: (selector) => selector === "[data-image]" ? item : null };
  await rootNode.emit("click", event(child, { detail: 0 }));
  assert.equal(placements.length, 1);
  assert.match(placements[0].requestId, /^keyboard-/);
});

test("controller listeners initialize once per controller and are removable", () => {
  const rootNode = new FakeRoot();
  const controller = activation.createController({ root: rootNode, activate() {} });
  assert.equal(activation.createController({ root: rootNode, activate() {} }), controller);
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "click"]) assert.equal(rootNode.listeners.get(type).length, 1);
  controller.destroy();
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "click"]) assert.equal(rootNode.listeners.get(type).length, 0);
});

test("object creation is request-idempotent and placement cleanup is unconditional", () => {
  const objects = fs.readFileSync(path.join(root, "altar/js/features/objects.js"), "utf8");
  const events = fs.readFileSync(path.join(root, "altar/js/core/events.js"), "utf8");
  assert.match(objects, /completedPlacementRequests\.has\(requestId\)/);
  assert.match(objects, /completedPlacementRequests\.add\(requestId\)/);
  assert.match(objects, /function resetAltarPointerState\(\)/);
  assert.match(events, /finally \{[\s\S]*resetAltarPointerState\(\)/);
  assert.match(events, /closeAltarCabinetOverlay\(\)/);
});
