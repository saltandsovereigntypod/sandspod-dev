const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function cabinetRecords() {
  const sandbox = { location: { search: "" }, dispatchEvent() {}, CustomEvent: class {}, URLSearchParams, console };
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
