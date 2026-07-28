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
      },
      crystal: {
        clear_quartz: { DisplayName: "Clear Quartz", Uses: "Amplification" }
      },
      candle: {
        white: { DisplayName: "White Candle", Uses: "Cleansing" }
      },
      tool: {
        cauldron: { DisplayName: "Cauldron", Uses: "Transformation" }
      },
      vessel: {
        spell_jar: { DisplayName: "Spell Jar", Uses: "Containment" }
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

test("altar identities resolve only to canonical Traditional entities", () => {
  const context = createLibraryContext();
  const library = context.__Library;
  library.importTraditionalLibrary();

  assert.equal(
    library.resolveObjectEntity({ crystal: "clear_quartz", type: "crystal" }).id,
    library.findEntityByTraditionalReference("traditional/crystal/clear_quartz").id
  );
  assert.equal(
    library.resolveObjectEntity({ color: "white", type: "candle" }).id,
    library.findEntityByTraditionalReference("traditional/candle/white").id
  );
  assert.equal(
    library.resolveObjectEntity({ vessel: "cauldron", type: "vessel" }).id,
    library.findEntityByTraditionalReference("traditional/tool/cauldron").id
  );
  assert.equal(library.resolveCanonicalEntityId("clear_quartz"), null);
  assert.equal(library.resolveCanonicalEntityId("Clear Quartz"), null);
  assert.equal(library.resolveCanonicalEntityId("clear-quartz.png"), null);
});

test("legacy duplicate content and relationships merge without losing authored values", () => {
  const context = createLibraryContext();
  const library = context.__Library;
  const duplicate = library.createEntity({
    id: "legacy-clear-quartz",
    name: "clear_quartz",
    type: "crystal",
    myPractice: { Notes: "Legacy note", Uses: ["Meditation"] },
    community: { Notes: "Community note" }
  });
  const related = library.createEntity({ name: "Related Entry", type: "note", metadata: { traditionalReference: null } });
  library.connect(duplicate.id, "pairs_with", related.id);

  library.importTraditionalLibrary();
  const canonical = library.findEntityByTraditionalReference("traditional/crystal/clear_quartz");

  assert.equal(library.getEntity(duplicate.id), null);
  assert.equal(library.resolveCanonicalEntityId(duplicate.id), canonical.id);
  assert.equal(canonical.myPractice.Notes, "Legacy note");
  assert.deepEqual(canonical.myPractice.Uses, ["Meditation"]);
  assert.equal(canonical.community.Notes, "Community note");
  assert.ok(library.getConnections(canonical.id).some((relation) => relation.to === related.id));
  assert.equal(library.importTraditionalLibrary().length, 0);
  assert.equal(canonical.myPractice.Notes, "Legacy note");
});

test("explicit custom entities are never merged by normalized names", () => {
  const context = createLibraryContext();
  const library = context.__Library;
  const custom = library.createEntity({
    id: "custom-quartz",
    name: "Clear Quartz",
    type: "crystal",
    metadata: { traditionalReference: null },
    myPractice: { Notes: "Intentionally custom" }
  });

  library.importTraditionalLibrary();
  assert.ok(library.getEntity(custom.id));
  assert.notEqual(custom.id, library.findEntityByTraditionalReference("traditional/crystal/clear_quartz").id);
  assert.equal(library.resolveObjectEntity({ entityId: custom.id, crystal: "clear_quartz" }).id, custom.id);
});

test("an older legacy cloud duplicate cannot restore deleted canonical practice", () => {
  const context = createLibraryContext();
  const library = context.__Library;
  const canonical = library.createEntity({
    id: "canonical-quartz",
    name: "Clear Quartz",
    type: "crystal",
    metadata: {
      traditionalReference: "traditional/crystal/clear_quartz",
      cloudUpdatedAt: "2026-07-28T12:00:00Z"
    },
    traditional: context.TraditionalLibrary.crystal.clear_quartz,
    myPractice: {}
  });
  library.createEntity({
    id: "old-quartz-row",
    name: "clear_quartz",
    type: "crystal",
    metadata: { cloudUpdatedAt: "2026-07-20T12:00:00Z" },
    myPractice: { Notes: "Deleted old content" }
  });

  const merges = library.importTraditionalLibrary();
  assert.deepEqual(canonical.myPractice, {});
  assert.equal(library.getEntity("old-quartz-row"), null);
  assert.equal(library.resolveCanonicalEntityId("old-quartz-row"), canonical.id);
  assert.ok(merges.some((merge) => merge.canonicalEntityId === canonical.id));
});
