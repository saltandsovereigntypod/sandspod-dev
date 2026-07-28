const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Catalog = require("../js/sanctuary-asset-catalog.js");

function cabinetRecords() {
  const sandbox = { location: { search: "" }, dispatchEvent() {}, CustomEvent: class {}, URLSearchParams, console, SanctuaryAssetCatalog: Catalog };
  sandbox.window = sandbox;
  vm.runInNewContext(`${fs.readFileSync("altar/js/features/cabinet.js", "utf8")}\nglobalThis.__records = window.AltarCabinet.getSearchRecords();`, sandbox);
  return sandbox.__records;
}

test("real cabinet definitions provide candle, herb, tool, and vessel search records", () => {
  const records = cabinetRecords();
  const find = (query) => records.filter((record) => `${record.title} ${record.aliases.join(" ")} ${record.fields.flat(Infinity).join(" ")}`.toLowerCase().includes(query));
  assert.ok(find("candle").length >= 1);
  assert.ok(find("rosemary").some((record) => record.title === "Rosemary"));
  assert.ok(find("jar").some((record) => record.title === "Spell Jar"));
  for (const title of ["Cauldron", "Athame", "Raven Skull"]) assert.ok(records.some((record) => record.title === title));
  assert.ok(records.every((record) => record.group === "cabinet" && record.href.startsWith("/altar/?cabinet=")));
});

test("built-in candles expose immutable form choices without duplicate entities", () => {
  const records = cabinetRecords();
  const whiteForms = records.filter((record) => record.subtitle?.endsWith("· White Candle"));
  assert.deepEqual([...new Set(whiteForms.map((record) => record.title))], ["Chime / Spell Candle", "Taper Candle", "Tea Light", "Pillar Candle", "Vigil Candle"]);
  assert.ok(whiteForms.every((record) => record.href.includes("cabinet=candles") && record.href.includes("form=")));
});
