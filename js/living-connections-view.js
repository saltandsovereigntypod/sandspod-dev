(function initializeLivingConnectionsView(global) {
  const EMPTY_JOURNEY_MESSAGE = "Your history with this entry will begin to gather here as you use it in rituals, recipes, altar work, and journal records.";

  function formatDate(value, options = {}) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, options.short
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" }).format(date);
  }

  function humanize(value = "") {
    return String(value)
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function fullEntryUrl(entityId) {
    const id = String(entityId || "").trim();
    return id ? `/grimoire/?entity=${encodeURIComponent(id)}` : null;
  }

  function pageUrl(pageId) {
    const id = String(pageId || "").trim();
    return id ? `/grimoire/?page=${encodeURIComponent(id)}` : null;
  }

  function limit(items = [], count = 5) {
    return {
      visible: items.slice(0, count),
      remaining: items.slice(count),
      total: items.length
    };
  }

  function eventView(event) {
    if (!event?.timestamp || !formatDate(event.timestamp)) return null;
    const pageId = event.metadata?.grimoirePageId || event.metadata?.pageId || null;
    return {
      id: event.id,
      type: event.type || "activity",
      source: event.source || "",
      label: event.label || humanize(event.type || "Activity"),
      date: formatDate(event.timestamp, { short: true }),
      timestamp: event.timestamp,
      href: pageUrl(pageId),
      context: event.metadata?.notes || event.metadata?.intention || ""
    };
  }

  function uniqueRecords(records = []) {
    const seen = new Set();
    return records.filter(Boolean).filter((record) => {
      const key = record.entityId ? `entity:${record.entityId}` : record.href ? `href:${record.href}` : `${record.label}|${record.date || ""}`;
      if (!record.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function eventRecord(event) {
    if (!event) return null;
    const pageId = event.metadata?.grimoirePageId || event.metadata?.pageId || null;
    return {
      label: event.label,
      href: pageUrl(pageId),
      date: formatDate(event.timestamp, { short: true })
    };
  }

  function relatedEntityRecord(record) {
    if (!record?.entityId || !record.label) return null;
    return {
      entityId: record.entityId,
      label: record.label,
      type: humanize(record.entityType || "entry"),
      href: fullEntryUrl(record.entityId),
      relation: humanize(record.relation || "related to")
    };
  }

  function groupReferences(references = {}) {
    const related = references.relatedEntities || [];
    const groups = [
      {
        key: "rituals",
        label: "Rituals",
        items: uniqueRecords((references.rituals || []).map(eventRecord))
      },
      {
        key: "journals",
        label: "Journal Entries",
        items: uniqueRecords((references.journals || []).map(eventRecord))
      },
      {
        key: "pages",
        label: "Book of Shadows Pages",
        items: uniqueRecords((references.bookOfShadowsPages || []).map((record) => {
          if (record.label) return eventRecord(record);
          return record.pageId ? { label: "Ritual journal page", href: pageUrl(record.pageId) } : null;
        }))
      },
      {
        key: "templates",
        label: "Ritual Templates",
        items: uniqueRecords([
          ...(references.templates || []).map(eventRecord),
          ...related.filter((record) => record.entityType === "ritual_template").map(relatedEntityRecord)
        ])
      },
      {
        key: "recipes",
        label: "Apothecary Recipes",
        items: uniqueRecords([
          ...(references.recipes || []).map(eventRecord),
          ...related.filter((record) => record.entityType === "apothecary").map(relatedEntityRecord)
        ])
      },
      {
        key: "relationships",
        label: "Library Relationships",
        items: uniqueRecords(related.map(relatedEntityRecord))
      }
    ];
    return groups.filter((group) => group.items.length).map((group) => ({ ...group, ...limit(group.items, 4) }));
  }

  function createJourneyModel(result = {}, options = {}) {
    const entity = result.entity || null;
    const usage = result.usage || { totalUses: 0, uses: [] };
    const ritualTypes = result.ritualTypes || [];
    const timeline = (result.timeline || []).map(eventView).filter(Boolean).reverse();
    const meaningfulTimeline = timeline.filter((event) => !String(event.id).endsWith(":created"));
    const hasHistory = usage.totalUses > 0 || meaningfulTimeline.length > 0;
    const summary = [];

    if (usage.firstUse?.timestamp) summary.push({ label: "First Worked With", value: formatDate(usage.firstUse.timestamp) });
    if (usage.lastUse?.timestamp) summary.push({
      label: "Most Recently Used",
      value: [usage.lastUse.label, formatDate(usage.lastUse.timestamp)].filter(Boolean).join(" · ")
    });
    if (usage.totalUses > 0) summary.push({ label: "Times Used", value: `${usage.totalUses} recorded appearance${usage.totalUses === 1 ? "" : "s"}` });
    if (ritualTypes[0]?.frequency) summary.push({ label: "Most Common Ritual Type", value: humanize(ritualTypes[0].ritualType) });

    const pairings = (result.pairings || [])
      .filter((pairing) => pairing.entity?.id && pairing.entity?.name && pairing.frequency > 0)
      .slice(0, options.pairingLimit || 6)
      .map((pairing) => ({
        entityId: pairing.entity.id,
        label: pairing.entity.name,
        type: humanize(pairing.entity.type || "entry"),
        frequency: pairing.frequency,
        description: `Appeared together in ${pairing.frequency} recorded working${pairing.frequency === 1 ? "" : "s"}`,
        href: fullEntryUrl(pairing.entity.id)
      }));

    const recent = limit(meaningfulTimeline, options.eventLimit || 5);
    return {
      entityId: result.entityId || entity?.id || null,
      entityName: entity?.name || "this entry",
      fullEntryHref: fullEntryUrl(result.entityId || entity?.id),
      hasHistory,
      emptyMessage: hasHistory ? "" : EMPTY_JOURNEY_MESSAGE,
      summary,
      pairings,
      referenceGroups: groupReferences(result.references || {}),
      recentEvents: recent.visible,
      olderEvents: recent.remaining,
      totalEvents: recent.total
    };
  }

  function isCurrentRequest(requestId, currentRequestId, expectedIdentity, currentIdentity) {
    return requestId === currentRequestId && String(expectedIdentity || "") === String(currentIdentity || "");
  }

  const api = {
    EMPTY_JOURNEY_MESSAGE,
    formatDate,
    humanize,
    fullEntryUrl,
    pageUrl,
    limit,
    groupReferences,
    createJourneyModel,
    isCurrentRequest
  };

  global.LivingConnectionsView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
