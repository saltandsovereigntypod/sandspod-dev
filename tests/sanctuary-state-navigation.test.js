const test = require("node:test");
const assert = require("node:assert/strict");
const Sanctuary = require("../js/living-sanctuary.js");
const Navigation = require("../js/sanctuary-search-navigation.js");

test("authoritative Sanctuary state never guesses unresolved auth", () => {
  const unresolved = Sanctuary.createViewState({}, () => true);
  assert.equal(unresolved.authResolved, false);
  assert.equal(unresolved.isGuest, false);
  assert.equal(unresolved.canModerate, false);
  const admin = Sanctuary.createViewState({ authResolved: true, user: { id: "admin" }, settings: { preferred_name: "Ashley" }, settingsResolved: true }, () => true);
  assert.equal(admin.canModerate, true);
  assert.equal(admin.isGuest, false);
  const guest = Sanctuary.createViewState({ authResolved: true, user: null, settingsResolved: true }, () => true);
  assert.equal(guest.isGuest, true);
  assert.equal(guest.canModerate, false);
});

test("greeting follows hydrated preferred, magical, and no-name settings", () => {
  assert.equal(Sanctuary.greeting({ preferred_name: "Ashley", sanctuary_greeting_name: "preferred" }, { user_metadata: {} }), "Welcome Home, Ashley");
  assert.equal(Sanctuary.greeting({ magical_name: "Freyja", sanctuary_greeting_name: "magical" }, {}), "Welcome Home, Freyja");
  assert.equal(Sanctuary.greeting({ preferred_name: "Ashley", sanctuary_greeting_name: "none" }, {}), "Welcome Home");
});

test("destination adapter preserves exact source destinations", () => {
  const library = { resolveCanonicalEntityId: (id) => id === "legacy" ? "canonical" : id };
  assert.equal(Navigation.destinationFor({ entityId: "legacy" }, library).href, "/grimoire/?entity=canonical");
  assert.equal(Navigation.destinationFor({ href: "/grimoire/?page=page-1" }, library).href, "/grimoire/?page=page-1");
  assert.deepEqual(Navigation.destinationFor({ action: { kind: "apothecary", id: "jar-1" } }, library), { kind: "place-apothecary-item", itemId: "jar-1", href: "/altar/?placeApothecaryItem=jar-1" });
  assert.equal(Navigation.destinationFor({ href: "/altar/?cabinet=candles&item=White%20Candle&form=tea-light" }, library).href, "/altar/?cabinet=candles&item=White%20Candle&form=tea-light");
  assert.equal(Navigation.destinationFor({}, library), null);
});

test("dispatcher captures destination before closing and passes exact IDs", () => {
  const calls = [];
  const result = { destination: { kind: "current-altar", instanceId: "instance-7", href: "/altar/?selectObject=instance-7" } };
  assert.equal(Navigation.open(result, { close: () => calls.push("close"), selectObject: (id) => calls.push(id) }), true);
  assert.deepEqual(calls, ["close", "instance-7"]);
  const apothecary = [];
  Navigation.open({ action: { kind: "apothecary", id: "jar-2" } }, { close() {}, placeApothecary: (id) => apothecary.push(id) });
  assert.deepEqual(apothecary, ["jar-2"]);
});

test("placement destinations remain distinct from selecting an existing instance", () => {
  const calls = [];
  Navigation.open({ destination: { kind: "place-cabinet-item", itemId: "candles:white-candle", formId: "vigil" } }, { close() {}, placeCabinet: (request) => calls.push(["cabinet", request.itemId, request.formId]) });
  Navigation.open({ destination: { kind: "place-apothecary-item", itemId: "jar-3" } }, { close() {}, placeApothecary: (id) => calls.push(["apothecary", id]) });
  Navigation.open({ destination: { kind: "current-altar", instanceId: "placed-1" } }, { close() {}, selectObject: (id) => calls.push(["select", id]) });
  assert.deepEqual(calls, [["cabinet", "candles:white-candle", "vigil"], ["apothecary", "jar-3"], ["select", "placed-1"]]);
});

test("late moderator readiness updates state without discarding hydrated settings", () => {
  const hydrated = Sanctuary.createViewState({ authResolved: true, user: { id: "admin" }, settings: { preferred_name: "Ash" }, settingsResolved: true }, () => false);
  const updated = Sanctuary.applyModeratorState(hydrated, { resolved: true, user: hydrated.user, canModerate: true });
  assert.equal(updated.canModerate, true);
  assert.deepEqual(updated.settings, hydrated.settings);
});
