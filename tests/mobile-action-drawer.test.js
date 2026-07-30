const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "altar/js/features/object-actions.js"), "utf8");

function loadDrawerHelpers({ mobile = true } = {}) {
  const scrollingElement = { scrollTop: 240, isConnected: true };
  const document = {
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    documentElement: scrollingElement,
    scrollingElement,
    addEventListener() {},
    querySelector() { return null; }
  };
  const window = {
    matchMedia() { return { matches: mobile, addEventListener() {}, addListener() {} }; },
    getComputedStyle(element) { return element.computedStyle || { overflowY: "visible" }; },
    requestAnimationFrame(callback) { callback(); }
  };
  const context = { window, document, toolbar: null, altarActionBar: null, console, FormData };
  vm.runInNewContext(source, context, { filename: "object-actions.js" });
  return { helpers: window.AltarObjectActionDrawer, scrollingElement };
}

test("the canonical action module owns drawer and anchor state", () => {
  assert.match(source, /let overflowOpen = false;\s*let overflowObject = null;\s*let pendingActionAnchor = null;/);
  assert.match(source, /pendingActionAnchor = closesDrawer \? null : captureActionAnchor\(actionId, object\)/);
  assert.match(source, /if \(closesDrawer\) closeObjectActionOverflow\(\);\s*await action\.handler\(object\)/);
});

test("mobile scroll-owner detection falls back to the page for the static action list", () => {
  const { helpers, scrollingElement } = loadDrawerHelpers();
  const body = { parentElement: null };
  const staticPanel = {
    parentElement: body,
    computedStyle: { overflowY: "visible" },
    scrollHeight: 1200,
    clientHeight: 400
  };
  const button = { parentElement: staticPanel };
  assert.equal(helpers.actionScrollOwner(button), scrollingElement);
});

test("mobile scroll-owner detection uses a genuinely scrolling ancestor", () => {
  const { helpers } = loadDrawerHelpers();
  const scrollPanel = {
    parentElement: null,
    computedStyle: { overflowY: "auto" },
    scrollHeight: 800,
    clientHeight: 300
  };
  const button = { parentElement: scrollPanel };
  assert.equal(helpers.actionScrollOwner(button), scrollPanel);
});

test("repeated actions restore viewport anchoring without scroll-driven focus", () => {
  assert.match(source, /replacement\.getBoundingClientRect\(\)\.top - anchor\.buttonViewportTop/);
  assert.match(source, /scrollContainer\.scrollTop \+= offset/);
  assert.match(source, /replacement\.focus\(\{ preventScroll: true \}\)/);
  for (const action of ["larger", "smaller", "rotate-left", "rotate-right", "forward", "backward"]) {
    assert.match(source, new RegExp(`id: "${action}"`));
  }
});

test("drawer has explicit exits and Escape closes it before deselection", () => {
  assert.match(source, /data-close-object-actions role="menuitem">Close Actions<\/button>/);
  assert.match(source, /if \(overflowOpen\) \{\s*event\.preventDefault\(\);\s*closeObjectActionOverflow\(\);\s*return;/s);
  assert.match(source, /const closesDrawer = actionId === "back-to-altar" \|\| actionId === "delete"/);
  assert.match(source, /if \(!event\.matches\) closeObjectActionOverflow\(\)/);
});

test("the interaction guard does not duplicate drawer state or observe its DOM", () => {
  const guard = fs.readFileSync(path.join(root, "altar/js/ui/selection-interaction-guard.js"), "utf8");
  assert.doesNotMatch(guard, /MutationObserver|overflowOpen|pendingActionAnchor|actionDrawerObject/);
  assert.match(guard, /pointerdown/);
});
