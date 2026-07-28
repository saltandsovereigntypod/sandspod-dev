const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Search = require("../js/sanctuary-search.js");
const Sanctuary = require("../js/living-sanctuary.js");

test("Apothecary custom name outranks type while both remain searchable", () => {
  const item = { id: "jar-1", name: "Test", type: "spell-jar", typeLabel: "Spell Jar", intention: "protection", ingredients: [{ label: "Rosemary" }] };
  Search.buildIndex({ apothecary: [Search.createApothecaryResult(item)] });
  assert.equal(Search.search("test")[0].score, 1000);
  assert.equal(Search.search("spell jar")[0].id, "jar-1");
  assert.equal(Search.search("rosemary")[0].id, "jar-1");
  Search.updateSource("apothecary", [Search.createApothecaryResult({ ...item, name: "Ancestor Jar" })]);
  assert.equal(Search.search("test").length, 0);
  assert.equal(Search.search("ancestor jar")[0].id, "jar-1");
  Search.updateSource("apothecary", []);
  assert.equal(Search.search("ancestor jar").length, 0);
});

test("moderation destination follows only the shared permission result", () => {
  const admin = { id: "admin" };
  assert.equal(Sanctuary.moderatorDestination(admin, (user) => user.id === "admin"), "/admin/submissions/");
  assert.equal(Sanctuary.moderatorDestination({ id: "regular" }, () => false), null);
  assert.equal(Sanctuary.moderatorDestination(null, () => false), null);
});

test("auth events refresh the open Sanctuary and search modal owns scroll lock", () => {
  const sanctuary = fs.readFileSync("js/living-sanctuary.js", "utf8");
  const ui = fs.readFileSync("js/sanctuary-search-ui.js", "utf8");
  const css = fs.readFileSync("css/styles.css", "utf8");
  assert.match(sanctuary, /saltAuthChanged[^\n]*refreshForAuth/);
  assert.match(sanctuary, /saltAuthReady[^\n]*refreshForAuth/);
  assert.match(ui, /classList\.add\("sanctuary-search-open"\)/);
  assert.match(ui, /classList\.remove\("sanctuary-search-open"\)/);
  assert.match(css, /grid-template-rows:\s*auto auto auto minmax\(0, 1fr\)/);
  assert.match(css, /\.sanctuary-search-results[\s\S]*?overflow-y:\s*auto/);
});
