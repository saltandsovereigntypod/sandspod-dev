const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const accessibility = require("../js/accessibility.js");
const root = path.join(__dirname, "..");

test("accessibility preferences validate stored values and enforce supported text scales", () => {
  assert.deepEqual(accessibility.normalize({ textScale: 99, highContrast: "yes" }), accessibility.DEFAULTS);
  assert.equal(accessibility.normalize({ textScale: 1.3, highContrast: true }).textScale, 1.3);
  assert.equal(accessibility.normalize({ textScale: 0.9 }).textScale, 0.9);
  assert.deepEqual(accessibility.SCALES, [0.9, 1, 1.1, 1.2, 1.3]);
});

test("guest and authenticated preference keys are isolated", () => {
  assert.equal(accessibility.storageKey("guest"), "saltAndSovereigntyAccessibility:guest");
  assert.equal(accessibility.storageKey("user:user-a"), "saltAndSovereigntyAccessibility:user:user-a");
  assert.notEqual(accessibility.storageKey("user:user-a"), accessibility.storageKey("user:user-b"));
});

test("the shared panel exposes pressed state, focus restoration, live announcements, and Escape handling", () => {
  const source = fs.readFileSync(path.join(root, "js/accessibility.js"), "utf8");
  assert.match(source, /aria-pressed/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /panel\.showModal\(\)/);
  assert.match(source, /trigger\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /pointerType === "touch"/);
});

test("accessibility CSS uses root variables and only hides marked decoration", () => {
  const css = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
  assert.match(css, /--accessibility-text-scale/);
  assert.match(css, /\.a11y-high-contrast \{[^}]+--cream:/s);
  assert.match(css, /\.a11y-hide-decoration \.is-decorative/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /\.a11y-hide-decoration\s+(?:svg|img)/);
});

test("primary Sanctuary pages load one shared accessibility entry point and preserve browser zoom", () => {
  const pages = ["index.html", "altar/index.html", "grimoire/index.html", "grimoire/community-grimoire.html", "submit/index.html", "account/reset-password/index.html"];
  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /accessibility\.js/);
    assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  }
});
