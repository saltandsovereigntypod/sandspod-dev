const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createLibraryContext() {
  const values = new Map();
  const context = {
    console,
    crypto,
    structuredClone,
    TraditionalLibrary: {
      herb: {
        basil: {
          DisplayName: "Basil",
          Uses: "Protection"
        }
      }
    },
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      }
    }
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "../js/library.js"), "utf8");
  vm.runInContext(`${source}\nglobalThis.__Library = Library;`, context);
  return context;
}

test("Traditional references attach to one stable canonical entity", () => {
  const context = createLibraryContext();
  const library = context.__Library;

  library.importTraditionalLibrary();
  const basil = library.findEntityByTraditionalReference("traditional/herb/basil");
  assert.ok(basil);
  assert.equal(basil.name, "Basil");
  assert.equal(basil.metadata.traditionalReference, "traditional/herb/basil");

  library.importTraditionalLibrary();
  assert.equal(
    library.findEntityByTraditionalReference("traditional/herb/basil").id,
    basil.id
  );
  assert.equal(library.searchTraditionalEntries("herb", "bas")[0].reference, "traditional/herb/basil");
});

test("Explicit custom entities remain unlinked when Traditional content grows", () => {
  const context = createLibraryContext();
  const library = context.__Library;
  const custom = library.createEntity({
    name: "Dream Herb",
    type: "herb",
    metadata: { traditionalReference: null }
  });

  context.TraditionalLibrary.herb.dream_herb = {
    DisplayName: "Dream Herb",
    Uses: "Dream work"
  };
  library.importTraditionalLibrary();

  const canonical = library.findEntityByTraditionalReference("traditional/herb/dream_herb");
  assert.ok(canonical);
  assert.notEqual(canonical.id, custom.id);
  assert.equal(library.getEntity(custom.id).metadata.traditionalReference, null);
});

test("Living Library prevents duplicate canonical relationship edges", () => {
  const context = createLibraryContext();
  const library = context.__Library;
  const first = library.createEntity({ name: "First", type: "herb" });
  const second = library.createEntity({ name: "Second", type: "herb" });

  library.connect(first.id, "pairs_with", second.id);
  library.connect(first.id, "pairs_with", second.id);

  const matches = library.exportLibrary().relations.filter((relation) => {
    return relation.from === first.id && relation.relation === "pairs_with" && relation.to === second.id;
  });
  assert.equal(matches.length, 1);
});
