(function initializeMyJourney(global) {
  const CATEGORY_LABELS = { library: "Living Library", pages: "Journal", rituals: "Rituals", templates: "Templates", apothecary: "Apothecary", objects: "Living Objects", offerings: "Offerings", altar: "Altar" };
  const validTime = (value) => { const time = Date.parse(value || ""); return Number.isFinite(time) ? time : null; };

  function normalizeEvent(record = {}) {
    const timestamp = record.timestamp || record.date || record.updated_at || record.created_at || null;
    if (!record.id || !record.title || !validTime(timestamp)) return null;
    return {
      id: String(record.id), category: record.category || record.group || "library", source: record.source || record.group || "library",
      timestamp: new Date(timestamp).toISOString(), title: String(record.title), description: record.description || record.relationshipContext || record.subtitle || "",
      entityId: record.entityId || null, destination: record.destination || record.href || null,
      searchText: [record.title, record.description, record.relationshipContext, record.fields].filter(Boolean).join(" "), metadata: { ...(record.metadata || {}) }
    };
  }

  function buildTimeline(records = []) {
    const seen = new Set();
    return records.map(normalizeEvent).filter(Boolean).filter((event) => {
      const key = `${event.source}:${event.id}:${event.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  function sortEvents(events = [], direction = "newest") {
    const multiplier = direction === "oldest" ? 1 : -1;
    return [...events].sort((a, b) => (validTime(a.timestamp) - validTime(b.timestamp)) * multiplier || a.id.localeCompare(b.id));
  }

  function filterEvents(events = [], options = {}) {
    const query = String(options.query || "").trim();
    const category = options.category || "all";
    let filtered = events.filter((event) => category === "all" || event.category === category);
    if (query && global.SanctuarySearch) {
      const records = filtered.map((event) => ({ id: event.id, group: "library", title: event.title, fields: [event.searchText, event.description], metadata: { journeyEvent: event } }));
      const ids = new Set(global.SanctuarySearch.rankRecords(records, query).map((result) => result.id));
      filtered = filtered.filter((event) => ids.has(event.id));
    } else if (query) {
      const term = query.toLowerCase(); filtered = filtered.filter((event) => `${event.title} ${event.searchText}`.toLowerCase().includes(term));
    }
    return sortEvents(filtered, options.direction);
  }

  function groupEvents(events = [], grouping = "month") {
    const groups = new Map();
    events.forEach((event) => {
      const date = new Date(event.timestamp);
      const key = grouping === "year" ? String(date.getFullYear()) : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(event);
    });
    return [...groups].map(([label, items]) => ({ label, items }));
  }

  function milestones(events = []) {
    const oldest = sortEvents(events, "oldest");
    const definitions = [["rituals", "Your first recorded ritual"], ["pages", "Your earliest journal page"], ["offerings", "Your first recorded offering"], ["apothecary", "Your first Apothecary recipe"], ["library", "Your earliest Living Library entry"]];
    return definitions.map(([category, label]) => { const event = oldest.find((item) => item.category === category); return event ? { label, event } : null; }).filter(Boolean).slice(0, 4);
  }

  function reflectiveSummary(events = []) {
    if (!events.length) return [];
    const oldest = sortEvents(events, "oldest")[0];
    const entities = new Set(events.map((event) => event.entityId).filter(Boolean));
    const rituals = events.filter((event) => event.category === "rituals").length;
    const recipes = events.filter((event) => event.category === "apothecary").length;
    return [
      oldest && `Your recorded Sanctuary begins on ${new Date(oldest.timestamp).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
      entities.size ? `${entities.size} distinct Living Library ${entities.size === 1 ? "entity appears" : "entities appear"} in this recorded chapter.` : "",
      rituals ? `${rituals} ritual ${rituals === 1 ? "record appears" : "records appear"} in your chronicle.` : "",
      recipes ? `${recipes} Apothecary ${recipes === 1 ? "recipe has" : "recipes have"} been recorded.` : ""
    ].filter(Boolean);
  }

  function recentThreads(events = [], limit = 30) {
    const recent = sortEvents(events).slice(0, limit);
    if (!recent.length) return [];
    const counts = new Map(); recent.forEach((event) => { if (event.entityId) counts.set(event.entityId, (counts.get(event.entityId) || 0) + 1); });
    return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([entityId, count]) => ({ entityId, count, text: `This entry appears in ${count} recently recorded moments.` }));
  }

  const api = { CATEGORY_LABELS, normalizeEvent, buildTimeline, sortEvents, filterEvents, groupEvents, milestones, reflectiveSummary, recentThreads };
  global.MyJourney = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
