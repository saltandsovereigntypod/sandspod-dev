const test = require("node:test");
const assert = require("node:assert/strict");
const Lifecycle = require("../js/ritual-lifecycle.js");

const clock = (value) => () => value;
const ids = (...values) => { let index = 0; return () => values[index++] || `id-${index}`; };
const template = () => ({ id: "template-1", title: "Moon Rite", intention: "Listen", linked_entities: ["entity-1"], ritual_template_steps: [{ id: "step-a", sort_order: 0, title: "Open" }, { id: "step-b", sort_order: 1, title: "Offer" }] });

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("starting one reusable template twice creates distinct session and step identities", () => {
  const first = Lifecycle.createSession(template(), { idFactory: ids("session-1", "s1-a", "s1-b"), clock: clock("2026-01-01T00:00:00.000Z") });
  const second = Lifecycle.createSession(template(), { idFactory: ids("session-2", "s2-a", "s2-b"), clock: clock("2026-01-02T00:00:00.000Z") });
  assert.notEqual(first.id, second.id);
  assert.equal(first.template_id, "template-1");
  assert.equal(second.template_id, "template-1");
  assert.notEqual(first.session_steps[0].id, second.session_steps[0].id);
});

test("session snapshots remain historical when the source template changes", () => {
  const source = template();
  const session = Lifecycle.createSession(source, { idFactory: ids("session", "a", "b") });
  source.title = "Renamed"; source.ritual_template_steps[0].title = "Changed";
  assert.equal(session.title, "Moon Rite");
  assert.equal(session.template_snapshot.steps[0].title, "Open");
  assert.equal(session.session_steps[0].title, "Open");
});

test("completion and meaningful events are idempotent", () => {
  const session = Lifecycle.createSession(template(), { idFactory: ids("session", "a", "b"), clock: clock("2026-01-01T00:00:00.000Z") });
  const once = Lifecycle.completeSession(session, { clock: clock("2026-01-02T00:00:00.000Z") });
  const twice = Lifecycle.completeSession(once, { clock: clock("2026-01-03T00:00:00.000Z") });
  assert.equal(twice.completed_at, "2026-01-02T00:00:00.000Z");
  assert.equal(twice.event_log.filter((event) => event.type === "session_completed").length, 1);
  const stepOnce = Lifecycle.appendEvent(session, { type: "step_completed", stepId: "a", idempotencyKey: "step:session:a" });
  const stepTwice = Lifecycle.appendEvent(stepOnce, { type: "step_completed", stepId: "a", idempotencyKey: "step:session:a" });
  assert.equal(stepTwice.event_log.filter((event) => event.type === "step_completed").length, 1);
});

test("one journal is upserted per session without rewriting session history", () => {
  const session = Lifecycle.completeSession(Lifecycle.createSession(template(), { idFactory: ids("session", "a", "b") }));
  const before = JSON.stringify(session.event_log);
  const first = Lifecycle.upsertJournal([], session, { reflection: "First" }, { idFactory: ids("journal") });
  const second = Lifecycle.upsertJournal(first.journals, session, { reflection: "Edited" }, { idFactory: ids("unused") });
  assert.equal(first.created, true); assert.equal(second.created, false);
  assert.equal(second.journals.length, 1); assert.equal(second.journal.id, "journal");
  assert.equal(JSON.stringify(session.event_log), before);
});

test("guest repository restores scoped active state and preserves independent records on deletion", () => {
  const storage = memoryStorage();
  const guest = Lifecycle.createLocalRepository(storage, "guest");
  const user = Lifecycle.createLocalRepository(storage, "user:abc");
  const session = guest.start(template(), { idFactory: ids("session", "a", "b") });
  assert.equal(Lifecycle.createLocalRepository(storage, "guest").getActive().id, session.id);
  assert.equal(user.getActive(), null);
  const journal = guest.upsertJournal(session, { reflection: "Kept" }, { idFactory: ids("journal") }).journal;
  guest.deleteSession(session.id);
  assert.equal(guest.read().journals[0].id, journal.id);
  const second = guest.start(template(), { idFactory: ids("session-2", "c", "d") });
  guest.deleteJournal(journal.id);
  assert.equal(guest.read().sessions[0].id, second.id);
});

test("newest timestamp wins during local/cloud hydration", () => {
  const local = { id: "same", updated_at: "2026-02-02T00:00:00Z", reflection: "local" };
  const remote = { id: "same", updated_at: "2026-02-01T00:00:00Z", reflection: "remote" };
  assert.equal(Lifecycle.newestRecord(local, remote).reflection, "local");
  assert.equal(Lifecycle.newestRecord(remote, local).reflection, "local");
});

test("ritual integrations distinguish references and preserve exact search IDs", () => {
  const fs = require("node:fs");
  const connections = fs.readFileSync("js/living-connections.js", "utf8");
  const search = fs.readFileSync("js/sanctuary-search-ui.js", "utf8");
  assert.match(connections, /referenceType: "template", countsAsUse: false/);
  assert.match(search, /type: "ritual-session"[\s\S]+ritualSession=\$\{encodeURIComponent\(activeSession\.id\)}/);
  assert.match(search, /editRitualTemplate=\$\{encodeURIComponent\(template\.id\)}/);
  assert.match(search, /grimoire_page_id \? `\/grimoire\/\?page=\$\{encodeURIComponent\(ritual\.grimoire_page_id\)}/);
});
