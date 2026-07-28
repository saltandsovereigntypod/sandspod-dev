const test = require("node:test");
const assert = require("node:assert/strict");
global.SanctuarySearch = require("../js/sanctuary-search.js");
const Journey = require("../js/my-journey.js");

const records = [
  { id: "late", group: "rituals", title: "Protection Working", timestamp: "2026-07-20T00:00:00Z", entityId: "rose" },
  { id: "early", group: "pages", title: "First Page", timestamp: "2026-01-02T00:00:00Z" },
  { id: "recipe", group: "apothecary", title: "Rose Oil", fields: ["rosemary"], timestamp: "2026-07-01T00:00:00Z", entityId: "rose" }
];

test("normalizes, deduplicates, and orders journey events", () => {
  const events = Journey.buildTimeline([...records, records[0]]);
  assert.equal(events.length, 3);
  assert.deepEqual(Journey.sortEvents(events).map((event) => event.id), ["late", "recipe", "early"]);
  assert.deepEqual(Journey.sortEvents(events, "oldest").map((event) => event.id), ["early", "recipe", "late"]);
});

test("groups, filters, and searches one normalized event set", () => {
  const events = Journey.buildTimeline(records);
  assert.equal(Journey.groupEvents(events, "year")[0].label, "2026");
  assert.deepEqual(Journey.filterEvents(events, { category: "rituals" }).map((event) => event.id), ["late"]);
  assert.deepEqual(Journey.filterEvents(events, { query: "rosemary" }).map((event) => event.id), ["recipe"]);
});

test("derives gentle milestones, summaries, and recent threads", () => {
  const events = Journey.buildTimeline(records);
  assert.ok(Journey.milestones(events).some((item) => item.label === "Your first recorded ritual"));
  assert.ok(Journey.reflectiveSummary(events).some((line) => line.includes("distinct Living Library")));
  assert.equal(Journey.recentThreads(events)[0].count, 2);
  assert.doesNotMatch([...Journey.reflectiveSummary(events), ...Journey.milestones(events).map((item) => item.label)].join(" "), /achievement|streak|overdue/i);
});

test("handles an empty chronicle", () => {
  assert.deepEqual(Journey.buildTimeline([]), []);
  assert.deepEqual(Journey.milestones([]), []);
});
