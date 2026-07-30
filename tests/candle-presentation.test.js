const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Candle Life owns precise lifecycle fields and live ticks never persist", () => {
  const lifecycle = read("altar/js/features/candle-lifecycle.js");
  for (const field of ["Form", "Expected life", "Burned", "Remaining", "Status", "Last lit", "Estimated burnout", "Burn history"]) {
    assert.ok(lifecycle.includes(field), field);
  }
  assert.match(lifecycle, /data-candle-life-burned/);
  assert.match(lifecycle, /data-candle-life-remaining/);
  const tick = lifecycle.match(/function updateCompanionDisplay\(\)[\s\S]+?\n  }/)?.[0] || "";
  assert.match(tick, /effectiveBurnedMs/);
  assert.match(tick, /remainingMs/);
  assert.doesNotMatch(tick, /persist\(|saveLivingObjectState|updateObjectInstance/);
});

test("generic Companion suppresses candle burn duplication but preserves non-candle rows", () => {
  const currentState = read("altar/js/ui/companion-current-state.js");
  const candleBranch = currentState.match(/if \(identity === "candle"\)[\s\S]+?} else if \(identity === "herb"\)/)?.[0] || "";
  assert.doesNotMatch(candleBranch, /Burning Time|Last Burned/);
  assert.match(candleBranch, /Dressed With|Current Ritual|Group/);
  assert.match(currentState, /Last Cleansed/);
  assert.match(currentState, /Last Offering/);
});

test("Companion title is display-only while the form badge and Cabinet labels remain", () => {
  const companion = read("altar/js/ui/companion-v2.js");
  const cabinet = read("altar/js/features/cabinet.js");
  assert.match(companion, /CandleLifecycle\.displayTitle/);
  assert.match(companion, /secondaryLabel: form/);
  assert.match(cabinet, /data-label="\$\{item\.name} \$\{form\.label}/);
});

test("summary uses precise compact time and explicit spent wording", () => {
  const lifecycle = read("altar/js/features/candle-lifecycle.js");
  assert.match(lifecycle, /formatDuration\(remainingMs\(candle\), \{ compact: true \}\)/);
  assert.match(lifecycle, /Candle life reached/);
});

test("candle modal and mobile layout styles are scoped and bounded", () => {
  const altarCss = read("altar/altar.css");
  assert.match(altarCss, /\.candle-life-summary h2[^}]+font-size: clamp\(2rem, 5vw, 3\.5rem\)/s);
  assert.match(altarCss, /\.candle-life-card dl > div,[\s\S]+grid-template-columns: minmax\(7\.5rem, \.8fr\) minmax\(0, 1\.2fr\)/);
  assert.match(altarCss, /@media \(max-width: 420px\)[\s\S]+grid-template-columns: 1fr/);
  assert.doesNotMatch(altarCss.match(/\.altar-hero h1[\s\S]+?}/)?.[0] || "", /clamp\(2rem, 5vw, 3\.5rem\)/);
});
