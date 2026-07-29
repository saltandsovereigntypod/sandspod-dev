const test = require("node:test");
const assert = require("node:assert/strict");
const Catalog = require("../js/sanctuary-asset-catalog.js");
const FormModel = require("../js/object-form-model.js");
const fs = require("node:fs");

test("lightweight catalogue exposes unique backgrounds outside Altar", () => {
  const backgrounds = Catalog.getBackgrounds();
  assert.deepEqual(backgrounds.map((item) => item.name), ["Forest Altar", "Deity Shelf Altar"]);
  assert.equal(new Set(backgrounds.map((item) => item.id)).size, backgrounds.length);
  assert.ok(backgrounds.every((item) => item.thumbnailPath.startsWith("/assets/")));
});

test("catalogue loads on every Sanctuary-capable page without Altar initialization", () => {
  for (const path of ["index.html", "altar/index.html", "grimoire/index.html", "grimoire/community-grimoire.html", "submit/index.html"]) {
    const html = fs.readFileSync(path, "utf8");
    assert.match(html, /sanctuary-asset-catalog\.js/);
  }
  assert.doesNotMatch(fs.readFileSync("js/sanctuary-asset-catalog.js", "utf8"), /querySelector|createElement|cabinetItems/);
});

test("catalogue describes candle, herb, and crystal forms without false images", () => {
  assert.deepEqual(Catalog.getForms("candle").map((item) => item.id), ["chime-spell", "taper", "tea-light", "pillar", "vigil"]);
  assert.ok(Catalog.getForms("herb").some((item) => item.id === "bundle"));
  assert.ok(Catalog.getForms("crystal").some((item) => item.id === "tumbled"));
  assert.equal(Catalog.getForms("candle").find((item) => item.id === "taper").supportedAsset, false);
});

test("forms and instances preserve one canonical entity identity", () => {
  const library = { resolveCanonicalEntityId: (id) => id === "legacy-rosemary" ? "rosemary" : id };
  const form = FormModel.createForm({ id: "garden-bundle", category: "herb", label: "Rosemary from My Garden", entityId: "legacy-rosemary", aliases: ["garden rosemary"] }, library);
  const instance = FormModel.createInstance({ instanceId: "placed-1", customName: "Ancestor Bundle" }, form, library);
  assert.equal(form.canonicalEntityId, "rosemary");
  assert.equal(instance.canonicalEntityId, "rosemary");
  assert.equal(instance.formId, "garden-bundle");
  assert.equal(instance.formSnapshot.label, "Rosemary from My Garden");
});
