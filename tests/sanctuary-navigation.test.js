const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("Book of Shadows exposes distinct Sanctuary and My Journey launchers", () => {
  const html = fs.readFileSync("grimoire/index.html", "utf8");
  assert.equal((html.match(/data-my-sanctuary-open/g) || []).length, 2);
  assert.match(html, /data-my-sanctuary-open>\s*Sanctuary/);
  assert.match(html, /data-my-sanctuary-view-button="journey">\s*My Journey/);
});

test("community and submission pages use the shared current Sanctuary scripts", () => {
  for (const path of ["grimoire/community-grimoire.html", "submit/index.html"]) {
    const html = fs.readFileSync(path, "utf8");
    assert.doesNotMatch(html, />\s*My Sanctuary\s*</);
    assert.match(html, /js\/living-sanctuary\.js/);
    assert.equal((html.match(/js\/my-sanctuary\.js/g) || []).length, 1);
  }
});
